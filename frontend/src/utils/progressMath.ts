/**
 * Progress-state math — PR 6 of the Designer rebuild.
 *
 * Pure helpers for moving a knitter's row counter forward or backward
 * within the canonical `ProgressState`. Centralized here so the Make
 * Mode UI doesn't reimplement off-by-one + clamping rules per button.
 *
 * Conventions:
 *  - Row numbers are 1-indexed in user-facing output. Internally a
 *    counter at row 0 means "not started yet."
 *  - `totalRows` is optional — when unknown, the counter can grow
 *    without bound.
 *  - All operations return a NEW `ProgressState` object; the input is
 *    never mutated.
 */

import type { ProgressState } from '../types/pattern';

/** Effective current row for a section. Returns 0 when never tracked. */
export function rowForSection(state: ProgressState, sectionId: string): number {
  return state.rowsBySection?.[sectionId] ?? 0;
}

/** Set the absolute row position for a section. Negative values clamp
 *  to 0. When `totalRows` is supplied, values above it clamp to the
 *  total. */
export function setRow(
  state: ProgressState,
  sectionId: string,
  row: number,
  totalRows?: number,
): ProgressState {
  let clamped = Math.max(0, Math.floor(row));
  if (totalRows !== undefined) clamped = Math.min(clamped, totalRows);
  return {
    ...state,
    rowsBySection: { ...(state.rowsBySection ?? {}), [sectionId]: clamped },
    activeSectionId: state.activeSectionId ?? sectionId,
  };
}

/** Increment a section's row by 1 (with optional cap). */
export function incrementRow(
  state: ProgressState,
  sectionId: string,
  totalRows?: number,
): ProgressState {
  const current = rowForSection(state, sectionId);
  return setRow(state, sectionId, current + 1, totalRows);
}

/** Decrement a section's row by 1 (clamps to 0). */
export function decrementRow(state: ProgressState, sectionId: string): ProgressState {
  const current = rowForSection(state, sectionId);
  return setRow(state, sectionId, current - 1);
}

/** Mark a section as fully complete (row = totalRows). No-op when
 *  totalRows is unknown. */
export function completeSection(
  state: ProgressState,
  sectionId: string,
  totalRows: number | undefined,
): ProgressState {
  if (totalRows === undefined) return state;
  return setRow(state, sectionId, totalRows, totalRows);
}

/** Reset a section to row 0. */
export function resetSection(state: ProgressState, sectionId: string): ProgressState {
  return setRow(state, sectionId, 0);
}

/** Switch the active section pointer. */
export function setActiveSection(
  state: ProgressState,
  sectionId: string | null,
): ProgressState {
  return { ...state, activeSectionId: sectionId };
}

/** Set/clear a named counter. */
export function setCounter(
  state: ProgressState,
  counterId: string,
  value: number,
): ProgressState {
  const next = { ...(state.counters ?? {}) };
  next[counterId] = Math.max(0, Math.floor(value));
  return { ...state, counters: next };
}

/** Increment a counter by 1. */
export function incrementCounter(state: ProgressState, counterId: string): ProgressState {
  const current = state.counters?.[counterId] ?? 0;
  return setCounter(state, counterId, current + 1);
}

/** Decrement a counter by 1 (clamps to 0). */
export function decrementCounter(state: ProgressState, counterId: string): ProgressState {
  const current = state.counters?.[counterId] ?? 0;
  return setCounter(state, counterId, current - 1);
}

/** Section progress fraction in [0, 1]. Returns 0 when totalRows is
 *  unknown or zero. */
export function sectionFraction(
  state: ProgressState,
  sectionId: string,
  totalRows: number | undefined,
): number {
  if (!totalRows || totalRows <= 0) return 0;
  const row = rowForSection(state, sectionId);
  return Math.max(0, Math.min(1, row / totalRows));
}

/** True when the section is at its `totalRows`. */
export function isSectionComplete(
  state: ProgressState,
  sectionId: string,
  totalRows: number | undefined,
): boolean {
  if (!totalRows) return false;
  return rowForSection(state, sectionId) >= totalRows;
}
