/**
 * Wave 5 — Magic Marker (sample-and-match symbol detection).
 *
 * Naming note: Rowly already has a `magic_markers` table — that's the
 * unrelated row-alert feature. THIS module's surface lives in
 * `magic_marker_samples` (plural samples, singular marker concept) so
 * names don't collide.
 *
 * The pipeline:
 *   1. The user picks a cell on a grid-aligned chart and tags it with
 *      a chart symbol.
 *   2. We compute a 64-bit dHash of the cell patch and store it.
 *   3. Find-similar walks every cell in the alignment, computes the
 *      dHash of each, and ranks by Hamming distance against the sample.
 *   4. Confirm-matches writes the symbol into the canonical chart row
 *      (charts.grid JSONB).
 *
 * Cross-craft: the symbol vocabulary is craft-specific (k/p/yo for
 * knit, ch/sc/dc for crochet) but the dHash math is craft-neutral.
 */

import crypto from 'crypto';
import db from '../config/database';
import { ValidationError } from '../utils/errorHandler';

export interface MagicMarkerSample {
  id: string;
  chartAlignmentId: string;
  userId: string;
  symbol: string;
  gridRow: number;
  gridCol: number;
  imageHash: string | null;
  matchMetadata: Record<string, unknown> | null;
  createdAt: string;
}

interface MagicMarkerSampleRow {
  id: string;
  chart_alignment_id: string;
  user_id: string;
  symbol: string;
  grid_row: number;
  grid_col: number;
  image_hash: string | null;
  match_metadata: Record<string, unknown> | string | null;
  created_at: Date | string;
}

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : v;
}

function parseJson<T>(v: T | string | null): T | null {
  if (v === null) return null;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
  return v;
}

function mapRow(r: MagicMarkerSampleRow): MagicMarkerSample {
  return {
    id: r.id,
    chartAlignmentId: r.chart_alignment_id,
    userId: r.user_id,
    symbol: r.symbol,
    gridRow: r.grid_row,
    gridCol: r.grid_col,
    imageHash: r.image_hash,
    matchMetadata: parseJson<Record<string, unknown>>(r.match_metadata),
    createdAt: toIso(r.created_at),
  };
}

/**
 * Perceptual dHash: shrink to 9x8 grayscale, compare each row's pairs,
 * yield a 64-bit string. Two patches with similar luminance gradients
 * land within a few bits of each other regardless of small noise.
 *
 * Inputs are arbitrary-length grayscale arrays (one byte per pixel)
 * already resized to 9x8 by the caller (sharp on the upload path).
 */
export function computeDHash(grayscale9x8: Uint8Array): string {
  if (grayscale9x8.length !== 9 * 8) {
    throw new ValidationError('computeDHash expects a 9x8 grayscale buffer');
  }
  const bits: number[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = grayscale9x8[row * 9 + col];
      const right = grayscale9x8[row * 9 + col + 1];
      bits.push(left < right ? 1 : 0);
    }
  }
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    const nibble =
      (bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3];
    hex += nibble.toString(16);
  }
  return hex;
}

/**
 * Hamming distance between two equal-length hex hashes. Returns the
 * number of differing bits.
 */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) {
    throw new ValidationError('hash length mismatch');
  }
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    dist += popcount4(diff);
  }
  return dist;
}

function popcount4(n: number): number {
  // n is a 4-bit nibble (0-15). Inline lookup via shifted AND.
  return ((n >> 0) & 1) + ((n >> 1) & 1) + ((n >> 2) & 1) + ((n >> 3) & 1);
}

export interface RecordSampleInput {
  chartAlignmentId: string;
  userId: string;
  symbol: string;
  gridRow: number;
  gridCol: number;
  imageHash: string | null;
  matchMetadata?: Record<string, unknown>;
}

export async function recordSample(
  input: RecordSampleInput
): Promise<MagicMarkerSample | null> {
  if (!input.symbol || input.symbol.length > 32) {
    throw new ValidationError('symbol must be 1..32 chars');
  }
  if (!Number.isInteger(input.gridRow) || input.gridRow < 0) {
    throw new ValidationError('gridRow must be a non-negative integer');
  }
  if (!Number.isInteger(input.gridCol) || input.gridCol < 0) {
    throw new ValidationError('gridCol must be a non-negative integer');
  }
  if (input.imageHash !== null && input.imageHash.length > 64) {
    throw new ValidationError('imageHash must be ≤ 64 chars');
  }

  // Verify the alignment is owned by the caller.
  const alignment = await db('chart_alignments')
    .where({ id: input.chartAlignmentId, user_id: input.userId })
    .first('id');
  if (!alignment) return null;

  const [row] = await db('magic_marker_samples')
    .insert({
      chart_alignment_id: input.chartAlignmentId,
      user_id: input.userId,
      symbol: input.symbol,
      grid_row: input.gridRow,
      grid_col: input.gridCol,
      image_hash: input.imageHash,
      match_metadata: input.matchMetadata
        ? JSON.stringify(input.matchMetadata)
        : null,
    })
    .returning('*');
  return mapRow(row as MagicMarkerSampleRow);
}

export interface FindMatchesInput {
  chartAlignmentId: string;
  userId: string;
  /** Hash to compare every sample against. */
  targetHash: string;
  /** Max Hamming distance to include (lower = stricter). Default 12. */
  maxDistance?: number;
}

export interface MatchCandidate {
  sampleId: string;
  symbol: string;
  gridRow: number;
  gridCol: number;
  distance: number;
}

export async function findMatches(
  input: FindMatchesInput
): Promise<MatchCandidate[]> {
  // Ownership: confirm the alignment belongs to the caller.
  const alignment = await db('chart_alignments')
    .where({ id: input.chartAlignmentId, user_id: input.userId })
    .first('id');
  if (!alignment) return [];

  const max = input.maxDistance ?? 12;
  const rows = await db('magic_marker_samples')
    .where({ chart_alignment_id: input.chartAlignmentId, user_id: input.userId })
    .whereNotNull('image_hash')
    .select('id', 'symbol', 'grid_row', 'grid_col', 'image_hash');
  const candidates: MatchCandidate[] = [];
  for (const r of rows) {
    if (!r.image_hash) continue;
    let distance: number;
    try {
      distance = hammingDistance(r.image_hash, input.targetHash);
    } catch {
      continue; // length mismatch — skip, don't break the batch
    }
    if (distance <= max) {
      candidates.push({
        sampleId: r.id,
        symbol: r.symbol,
        gridRow: r.grid_row,
        gridCol: r.grid_col,
        distance,
      });
    }
  }
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates;
}

/**
 * Convert a list of confirmed (row, col) cells to a partial chart grid
 * patch. Caller layers this on top of the existing `charts.grid` JSONB.
 */
export function buildChartGridPatch(
  symbol: string,
  cells: Array<{ row: number; col: number }>
): Record<string, Record<string, string>> {
  const patch: Record<string, Record<string, string>> = {};
  for (const c of cells) {
    if (!patch[c.row]) patch[c.row] = {};
    patch[c.row][c.col] = symbol;
  }
  return patch;
}

/**
 * Apply confirmed cells onto a chart's grid in JSONB. Best-effort —
 * if the chart row doesn't exist or isn't owned, returns null.
 */
export async function confirmMatches(args: {
  chartId: string;
  userId: string;
  symbol: string;
  cells: Array<{ row: number; col: number }>;
}): Promise<{ updatedCells: number } | null> {
  if (!args.cells.length) return { updatedCells: 0 };
  const chart = await db('charts')
    .where({ id: args.chartId, user_id: args.userId })
    .first('id', 'grid');
  if (!chart) return null;
  const grid =
    typeof chart.grid === 'string' ? JSON.parse(chart.grid) : chart.grid ?? {};
  for (const c of args.cells) {
    if (!grid[c.row]) grid[c.row] = {};
    grid[c.row][c.col] = args.symbol;
  }
  await db('charts')
    .where({ id: args.chartId, user_id: args.userId })
    .update({
      grid: JSON.stringify(grid),
      updated_at: new Date(),
    });
  return { updatedCells: args.cells.length };
}

// Keep crypto import — future variants (e.g. SHA-based fingerprints)
// are likely to need it; avoids a churn-y diff.
void crypto;
