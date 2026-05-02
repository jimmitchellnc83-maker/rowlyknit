/**
 * Wave 5 — chart grid alignment service.
 *
 * `chart_alignments` is a per-crop singleton (unique constraint on
 * `pattern_crop_id`). The service does an upsert via DELETE-then-INSERT
 * because Postgres ON CONFLICT requires us to know the conflict target,
 * which is fine here since the unique key is exactly that.
 *
 * Cross-craft: cell math is dimension-agnostic. Filet crochet charts
 * (square cells) and knit charts (often rectangular) flow through the
 * same path. Per-cell width/height in normalized coords is just
 * `grid_width / cells_across` and `grid_height / cells_down`.
 */

import db from '../config/database';
import { ValidationError } from '../utils/errorHandler';

export interface ChartAlignment {
  id: string;
  patternCropId: string;
  userId: string;
  gridX: number;
  gridY: number;
  gridWidth: number;
  gridHeight: number;
  cellsAcross: number;
  cellsDown: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChartAlignmentRow {
  id: string;
  pattern_crop_id: string;
  user_id: string;
  grid_x: number;
  grid_y: number;
  grid_width: number;
  grid_height: number;
  cells_across: number;
  cells_down: number;
  created_at: Date | string;
  updated_at: Date | string;
}

function toIso(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : v;
}

function mapRow(row: ChartAlignmentRow): ChartAlignment {
  return {
    id: row.id,
    patternCropId: row.pattern_crop_id,
    userId: row.user_id,
    gridX: Number(row.grid_x),
    gridY: Number(row.grid_y),
    gridWidth: Number(row.grid_width),
    gridHeight: Number(row.grid_height),
    cellsAcross: row.cells_across,
    cellsDown: row.cells_down,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export interface SetAlignmentInput {
  cropId: string;
  userId: string;
  gridX: number;
  gridY: number;
  gridWidth: number;
  gridHeight: number;
  cellsAcross: number;
  cellsDown: number;
}

export function assertValidAlignment(input: SetAlignmentInput): void {
  if (!Number.isInteger(input.cellsAcross) || input.cellsAcross < 1) {
    throw new ValidationError('cellsAcross must be a positive integer');
  }
  if (!Number.isInteger(input.cellsDown) || input.cellsDown < 1) {
    throw new ValidationError('cellsDown must be a positive integer');
  }
  const { gridX, gridY, gridWidth, gridHeight } = input;
  if (!(gridX >= 0 && gridX <= 1 && gridY >= 0 && gridY <= 1)) {
    throw new ValidationError('grid origin must be in [0, 1]');
  }
  if (!(gridWidth > 0 && gridWidth <= 1) || !(gridHeight > 0 && gridHeight <= 1)) {
    throw new ValidationError('grid dimensions must be in (0, 1]');
  }
  if (gridX + gridWidth > 1 + 1e-9 || gridY + gridHeight > 1 + 1e-9) {
    throw new ValidationError('grid rectangle must stay inside the unit square');
  }
}

export async function setAlignment(
  input: SetAlignmentInput
): Promise<ChartAlignment | null> {
  assertValidAlignment(input);
  // Confirm the parent crop is owned by the caller.
  const crop = await db('pattern_crops')
    .where({ id: input.cropId, user_id: input.userId })
    .whereNull('deleted_at')
    .first('id');
  if (!crop) return null;

  // Upsert via ON CONFLICT (pattern_crop_id) DO UPDATE.
  await db('chart_alignments')
    .insert({
      pattern_crop_id: input.cropId,
      user_id: input.userId,
      grid_x: input.gridX,
      grid_y: input.gridY,
      grid_width: input.gridWidth,
      grid_height: input.gridHeight,
      cells_across: input.cellsAcross,
      cells_down: input.cellsDown,
    })
    .onConflict('pattern_crop_id')
    .merge({
      grid_x: input.gridX,
      grid_y: input.gridY,
      grid_width: input.gridWidth,
      grid_height: input.gridHeight,
      cells_across: input.cellsAcross,
      cells_down: input.cellsDown,
      updated_at: new Date(),
    });

  const row = await db('chart_alignments')
    .where({ pattern_crop_id: input.cropId, user_id: input.userId })
    .first();
  return row ? mapRow(row as ChartAlignmentRow) : null;
}

export async function getAlignmentForCrop(
  cropId: string,
  userId: string
): Promise<ChartAlignment | null> {
  const row = await db('chart_alignments')
    .where({ pattern_crop_id: cropId, user_id: userId })
    .first();
  return row ? mapRow(row as ChartAlignmentRow) : null;
}
