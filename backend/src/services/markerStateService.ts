/**
 * Wave 4 — canonical MarkerState service.
 *
 * Adapter, not replacement. Existing surfaces (counters / panels /
 * canonical chart progress) keep their own write paths; this module
 * exposes:
 *
 *   recordPosition(...)   — upsert + history append + ring-buffer prune
 *   getPositionFor(...)   — current position
 *   getHistory(...)       — last N moves across all surfaces
 *   rewindTo(...)         — apply a history snapshot, log the rewind
 *
 * Controllers call recordPosition AFTER each successful DB write
 * (countersController emits already; we add a sibling). UI tabs and
 * sidebars read history from getHistory.
 *
 * Cross-craft: position is JSONB and surface is a small enum. Knit
 * counters write { currentCount }; panel mode writes { panelIndex,
 * rowInPanel }; chart writes { row, col }. Same shape for crochet.
 */

import db from '../config/database';
import logger from '../config/logger';
import {
  MARKER_HISTORY_CAP_PER_PROJECT,
  type MarkerPosition,
  type MarkerState,
  type MarkerStateHistoryEntry,
  type MarkerStateHistoryRow,
  type MarkerStateRow,
  type MarkerSurface,
} from '../types/markerState';

function toIsoNonNull(v: Date | string): string {
  return v instanceof Date ? v.toISOString() : v;
}

function parseJsonOrPassthrough<T>(v: T | string | null): T | null {
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

function mapStateRow(row: MarkerStateRow): MarkerState {
  return {
    id: row.id,
    projectId: row.project_id,
    patternId: row.pattern_id,
    surface: row.surface,
    surfaceRef: row.surface_ref,
    position:
      (parseJsonOrPassthrough<MarkerPosition>(row.position) as
        | MarkerPosition
        | null) ?? {},
    updatedAt: toIsoNonNull(row.updated_at),
  };
}

function mapHistoryRow(row: MarkerStateHistoryRow): MarkerStateHistoryEntry {
  return {
    id: row.id,
    markerStateId: row.marker_state_id,
    projectId: row.project_id,
    userId: row.user_id,
    previousPosition:
      parseJsonOrPassthrough<MarkerPosition>(row.previous_position) ?? null,
    newPosition:
      (parseJsonOrPassthrough<MarkerPosition>(row.new_position) as
        | MarkerPosition
        | null) ?? {},
    createdAt: toIsoNonNull(row.created_at),
    surface: row.surface ?? 'counter',
    surfaceRef: row.surface_ref ?? null,
  };
}

interface RecordPositionInput {
  projectId: string;
  patternId?: string | null;
  surface: MarkerSurface;
  surfaceRef?: string | null;
  position: MarkerPosition;
  userId: string;
}

/**
 * Upsert (project, pattern, surface, surfaceRef) → position. Append a
 * history row so the move can be rewound. Best-effort: errors are
 * logged but never propagate — Wave 4's contract is "the existing
 * write path is canonical; the marker-state mirror is observability."
 */
export async function recordPosition(input: RecordPositionInput): Promise<void> {
  try {
    const existing = await db('marker_states')
      .where({
        project_id: input.projectId,
        pattern_id: input.patternId ?? null,
        surface: input.surface,
        surface_ref: input.surfaceRef ?? null,
      })
      .first();

    let stateId: string;
    let previous: MarkerPosition | null = null;
    if (existing) {
      stateId = existing.id;
      previous =
        parseJsonOrPassthrough<MarkerPosition>(existing.position) ?? null;
      await db('marker_states')
        .where({ id: stateId })
        .update({
          position: JSON.stringify(input.position),
          updated_at: new Date(),
        });
    } else {
      const [row] = await db('marker_states')
        .insert({
          project_id: input.projectId,
          pattern_id: input.patternId ?? null,
          surface: input.surface,
          surface_ref: input.surfaceRef ?? null,
          position: JSON.stringify(input.position),
        })
        .returning('id');
      stateId = row.id;
    }

    await db('marker_state_history').insert({
      marker_state_id: stateId,
      project_id: input.projectId,
      user_id: input.userId,
      previous_position:
        previous === null ? null : JSON.stringify(previous),
      new_position: JSON.stringify(input.position),
    });

    // Ring-buffer prune. Keep the most-recent CAP rows for this
    // project; delete anything older. Cheap because the history index
    // is (project_id, created_at).
    await db.raw(
      `
      DELETE FROM marker_state_history
      WHERE project_id = ?
        AND id NOT IN (
          SELECT id FROM marker_state_history
          WHERE project_id = ?
          ORDER BY created_at DESC
          LIMIT ?
        )
      `,
      [input.projectId, input.projectId, MARKER_HISTORY_CAP_PER_PROJECT]
    );
  } catch (err) {
    logger.warn('recordPosition failed (best-effort)', {
      error: err instanceof Error ? err.message : String(err),
      projectId: input.projectId,
      surface: input.surface,
    });
  }
}

export async function getPositionFor(args: {
  projectId: string;
  patternId?: string | null;
  surface: MarkerSurface;
  surfaceRef?: string | null;
}): Promise<MarkerState | null> {
  const row = await db('marker_states')
    .where({
      project_id: args.projectId,
      pattern_id: args.patternId ?? null,
      surface: args.surface,
      surface_ref: args.surfaceRef ?? null,
    })
    .first();
  return row ? mapStateRow(row as MarkerStateRow) : null;
}

export async function getHistory(args: {
  projectId: string;
  userId: string;
  limit?: number;
}): Promise<MarkerStateHistoryEntry[]> {
  // Ownership: history rows are project-scoped; verify the project is
  // owned before returning anything.
  const project = await db('projects')
    .where({ id: args.projectId, user_id: args.userId })
    .whereNull('deleted_at')
    .first('id');
  if (!project) return [];

  const limit = Math.max(1, Math.min(args.limit ?? 50, 500));
  const rows = await db('marker_state_history as h')
    .leftJoin('marker_states as s', 'h.marker_state_id', 's.id')
    .where({ 'h.project_id': args.projectId })
    .orderBy('h.created_at', 'desc')
    .limit(limit)
    .select(
      'h.*',
      's.surface as surface',
      's.surface_ref as surface_ref'
    );
  return rows.map((r) => mapHistoryRow(r as MarkerStateHistoryRow));
}

export async function rewindTo(args: {
  historyId: string;
  userId: string;
}): Promise<MarkerStateHistoryEntry | null> {
  const entry = await db('marker_state_history as h')
    .leftJoin('marker_states as s', 'h.marker_state_id', 's.id')
    .leftJoin('projects as p', 'h.project_id', 'p.id')
    .where({ 'h.id': args.historyId, 'p.user_id': args.userId })
    .whereNull('p.deleted_at')
    .first(
      'h.*',
      's.surface as surface',
      's.surface_ref as surface_ref',
      's.id as marker_state_id_resolved'
    );
  if (!entry) return null;

  const previous = parseJsonOrPassthrough<MarkerPosition>(
    entry.previous_position
  );
  if (!previous) return null;

  await db('marker_states').where({ id: entry.marker_state_id }).update({
    position: JSON.stringify(previous),
    updated_at: new Date(),
  });

  // Log the rewind itself so someone can undo the undo.
  const newPos =
    parseJsonOrPassthrough<MarkerPosition>(entry.new_position) ?? {};
  const [row] = await db('marker_state_history')
    .insert({
      marker_state_id: entry.marker_state_id,
      project_id: entry.project_id,
      user_id: args.userId,
      previous_position: JSON.stringify(newPos),
      new_position: JSON.stringify(previous),
    })
    .returning('*');
  return mapHistoryRow({
    ...(row as MarkerStateHistoryRow),
    surface: entry.surface,
    surface_ref: entry.surface_ref,
  });
}
