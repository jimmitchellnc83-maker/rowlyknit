/**
 * Pure helpers for merging legacy + canonical patterns into the
 * AddPatternModal's picker options.
 *
 * The two sources overlap: a legacy pattern can have a canonical twin
 * (Designer-saved patterns materialize one), and a canonical pattern can
 * have a legacy stub (canonical-only patterns get one materialized when
 * they're attached to any project — see `materializeLegacyStubForCanonical`
 * in the backend `patternService`). When `pattern_models.source_pattern_id`
 * is set, the canonical row is reachable via the legacy list — surfacing it
 * a second time would clutter the picker, so we filter those out.
 *
 * The remaining canonical rows are "canonical-only" patterns the backend
 * accepts via the `{ patternModelId }` branch on `POST /api/projects/:id/
 * patterns`. The UI tags them with `kind: 'canonical'` so the submit
 * handler routes the request body correctly without the modal needing to
 * know about the API shape.
 */

export type PatternPickerKind = 'legacy' | 'canonical';

export interface LegacyPatternRef {
  id: string;
  name: string;
  designer?: string | null;
}

export interface CanonicalPatternRef {
  id: string;
  name: string;
  sourcePatternId: string | null;
}

export interface PatternPickerOption {
  id: string;
  kind: PatternPickerKind;
  name: string;
  designer: string | null;
}

/**
 * Merge legacy + canonical pattern lists into picker options. Canonical
 * rows that already have a legacy twin (`sourcePatternId` set) are dropped
 * to avoid showing the same pattern twice. Order: legacy first, then
 * canonical-only — matches the visual grouping the modal renders.
 */
export function buildAvailablePatternOptions(
  legacy: LegacyPatternRef[],
  canonical: CanonicalPatternRef[],
): PatternPickerOption[] {
  const legacyOptions: PatternPickerOption[] = legacy.map((p) => ({
    id: p.id,
    kind: 'legacy',
    name: p.name,
    designer: p.designer ?? null,
  }));
  const canonicalOnly = canonical.filter((p) => !p.sourcePatternId);
  const canonicalOptions: PatternPickerOption[] = canonicalOnly.map((p) => ({
    id: p.id,
    kind: 'canonical',
    name: p.name,
    designer: null,
  }));
  return [...legacyOptions, ...canonicalOptions];
}
