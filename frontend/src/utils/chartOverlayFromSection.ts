/**
 * Canonical-section → ChartOverlay props adapter (PR 8 of the Designer
 * rebuild).
 *
 * `ChartOverlay` is now placement- and expansion-aware. This module
 * builds the additive props from a `PatternSection`'s `chartPlacement`
 * and an optional structured row sequence stored in
 * `parameters._rowSequence`.
 *
 * Why a separate adapter? Schematic components (BodySchematic et al.)
 * accept a flat `ChartData` and don't know about Pattern/Section. Two
 * call patterns coexist:
 *   1. Legacy schematics — pass `chart` through, no placement, no
 *      expandedRows. ChartOverlay falls back to the bottom-left tile.
 *   2. Canonical surfaces (Author/Make mode chart preview) — fetch a
 *      `PatternSection`, run it through this adapter, spread the result
 *      into ChartOverlay alongside the schematic-supplied geometry
 *      (clipPath, bounds, stitchToPx, rowToPx, clipId).
 *
 * This keeps ChartOverlay a single primitive without forcing the
 * schematic call sites to learn the canonical model.
 */

import type { PatternSection } from '../types/pattern';
import type { ExpandedRow, SectionRowSequence } from '../types/repeat';
import { expandSection } from './repeatEngine';

export interface CanonicalOverlayProps {
  placement: PatternSection['chartPlacement'];
  expandedRows?: ExpandedRow[];
}

/**
 * Build ChartOverlay's canonical props from a section. Reads
 * `section.chartPlacement` directly and runs `expandSection` when the
 * section's parameters carry a structured `_rowSequence` payload.
 *
 * The `_rowSequence` storage convention: a `SectionRowSequence` JSON
 * blob saved under `parameters._rowSequence` by the Author UI. Legacy
 * sections won't have one — we return `undefined` for `expandedRows` in
 * that case and ChartOverlay defaults to filling the bounds vertically.
 *
 * Pure — no React, no I/O.
 */
export function chartOverlayPropsFromSection(
  section: PatternSection,
): CanonicalOverlayProps {
  const placement = section.chartPlacement ?? null;
  const sequence = readRowSequence(section);
  if (!sequence) {
    return { placement };
  }
  const expansion = expandSection(sequence);
  return {
    placement,
    expandedRows: expansion.rows,
  };
}

/**
 * Convenience: when a caller already has an `ExpandedRow[]` from
 * elsewhere (e.g. it ran `expandSection` once for instruction text and
 * wants to share the result with the chart layer), use this to attach
 * the placement without recomputing.
 */
export function chartOverlayPropsFromSectionWith(
  section: PatternSection,
  expandedRows: ExpandedRow[],
): CanonicalOverlayProps {
  return {
    placement: section.chartPlacement ?? null,
    expandedRows,
  };
}

const ROW_SEQUENCE_KEY = '_rowSequence';

const readRowSequence = (section: PatternSection): SectionRowSequence | null => {
  const raw = section.parameters[ROW_SEQUENCE_KEY];
  if (!raw || typeof raw !== 'object') return null;
  // Light validation — the engine itself doesn't crash on malformed
  // input, just emits warnings, so we trust the shape rather than doing
  // a full schema check here.
  if (!('items' in raw) || !Array.isArray((raw as SectionRowSequence).items)) {
    return null;
  }
  return raw as SectionRowSequence;
};
