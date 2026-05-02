/**
 * Wave 4 — canonical marker state type layer.
 *
 * Mirrors marker_states + marker_state_history (migration #074).
 * `position` is a permissive JSONB shape because crafts and surfaces
 * use different keys: knit counters use `{ currentCount }`, panel
 * mode adds `{ panelIndex, rowInPanel }`, chart cell progress uses
 * `{ row, col }`. Cross-craft growth = add keys, not new types.
 */

export type MarkerSurface = 'counter' | 'panel' | 'chart';

/** Free-form per-surface position bag. Keys vary by surface. */
export type MarkerPosition = Record<string, unknown>;

export interface MarkerState {
  id: string;
  projectId: string;
  patternId: string | null;
  surface: MarkerSurface;
  surfaceRef: string | null;
  position: MarkerPosition;
  updatedAt: string;
}

export interface MarkerStateRow {
  id: string;
  project_id: string;
  pattern_id: string | null;
  surface: MarkerSurface;
  surface_ref: string | null;
  position: MarkerPosition | string;
  updated_at: Date | string;
}

export interface MarkerStateHistoryEntry {
  id: string;
  markerStateId: string;
  projectId: string;
  userId: string;
  previousPosition: MarkerPosition | null;
  newPosition: MarkerPosition;
  createdAt: string;
  /** Surface metadata copied from the joined marker_states row. */
  surface: MarkerSurface;
  surfaceRef: string | null;
}

export interface MarkerStateHistoryRow {
  id: string;
  marker_state_id: string;
  project_id: string;
  user_id: string;
  previous_position: MarkerPosition | string | null;
  new_position: MarkerPosition | string;
  created_at: Date | string;
  surface?: MarkerSurface;
  surface_ref?: string | null;
}

/** Cap how many history rows we keep per project (most-recent N). */
export const MARKER_HISTORY_CAP_PER_PROJECT = 500;
