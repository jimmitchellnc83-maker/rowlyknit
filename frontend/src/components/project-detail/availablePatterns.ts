/**
 * Pure helpers for merging legacy + canonical patterns into the
 * AddPatternModal's picker options.
 *
 * The two sources overlap: a legacy pattern can have a canonical twin
 * (Designer-saved patterns materialize one), and a canonical pattern can
 * have a legacy stub (canonical-only patterns get one materialized when
 * they're attached to any project — see `materializeLegacyStubForCanonical`
 * in the backend `patternService`). When `pattern_models.source_pattern_id`
 * is set AND the pointed-to legacy is alive (visible in the user's
 * pattern list, or already attached to this project), the canonical row
 * is reachable via the legacy list — surfacing it a second time would
 * clutter the picker, so we filter those out.
 *
 * Stale-link canonicals (sourcePatternId set, but the pointed-to legacy
 * is missing/soft-deleted/owned-by-another-user) are kept in the picker.
 * The backend `materializeLegacyStubForCanonical` has a recovery branch
 * for these — it falls through to a fresh insert and overwrites the
 * stale link inside its transaction. Hiding them in the UI would block
 * users from invoking that recovery, leaving the canonical orphaned.
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
 * Merge legacy + canonical pattern lists into picker options. A canonical
 * row is dropped only when its `sourcePatternId` matches a visible legacy
 * pattern (one in `legacy`) OR a legacy that's already attached to the
 * project (`attachedLegacyIds`). All other canonicals are kept — including
 * stale-link ones, which the backend recovers on attach. Order: legacy
 * first, then canonical — matches the visual grouping the modal renders.
 */
export function buildAvailablePatternOptions(
  legacy: LegacyPatternRef[],
  canonical: CanonicalPatternRef[],
  attachedLegacyIds: string[] = [],
): PatternPickerOption[] {
  const legacyOptions: PatternPickerOption[] = legacy.map((p) => ({
    id: p.id,
    kind: 'legacy',
    name: p.name,
    designer: p.designer ?? null,
  }));

  // Anything we can already reach via the legacy list — visible in the
  // user's pattern library, or already attached to this project (which
  // covers soft-deleted legacy rows still linked through project_patterns).
  const reachableLegacy = new Set<string>([
    ...legacy.map((p) => p.id),
    ...attachedLegacyIds,
  ]);

  const canonicalKept = canonical.filter((p) => {
    if (!p.sourcePatternId) return true; // never linked → canonical-only
    if (reachableLegacy.has(p.sourcePatternId)) return false; // alive twin
    return true; // stale link — keep so backend recovery can run
  });
  const canonicalOptions: PatternPickerOption[] = canonicalKept.map((p) => ({
    id: p.id,
    kind: 'canonical',
    name: p.name,
    designer: null,
  }));
  return [...legacyOptions, ...canonicalOptions];
}
