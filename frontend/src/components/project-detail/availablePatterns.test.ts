/**
 * Sprint 2 fix-up: dedupe legacy + canonical pattern lists into a single
 * picker without showing the same pattern twice (Codex review on PR #375).
 *
 * The Designer-saved pattern flow creates BOTH a legacy `patterns` row
 * and a canonical `pattern_models` row linked by `source_pattern_id`. The
 * canonical-only attach flow ALSO materializes a legacy stub on attach,
 * back-linking the canonical via `source_pattern_id`. In both cases the
 * canonical row is reachable via the legacy list — surfacing it again as
 * a "canonical-only" pick would be a confusing dupe.
 *
 * The helper drops a canonical only when its `sourcePatternId` matches a
 * visible legacy row OR a legacy already attached to the project. Stale
 * links (sourcePatternId set, but pointed-to legacy missing/deleted) are
 * KEPT — the backend's `materializeLegacyStubForCanonical` has a recovery
 * branch for them, and hiding them in the UI would block the recovery.
 */

import { describe, expect, it } from 'vitest';
import { buildAvailablePatternOptions } from './availablePatterns';

describe('buildAvailablePatternOptions', () => {
  it('returns legacy options first, then canonical-only', () => {
    const out = buildAvailablePatternOptions(
      [
        { id: 'legacy-1', name: 'Sweater', designer: 'Alice' },
        { id: 'legacy-2', name: 'Hat', designer: null },
      ],
      [
        { id: 'cpm-1', name: 'Designer-only chart', sourcePatternId: null },
      ],
    );
    expect(out.map((o) => o.id)).toEqual(['legacy-1', 'legacy-2', 'cpm-1']);
    expect(out.map((o) => o.kind)).toEqual(['legacy', 'legacy', 'canonical']);
  });

  it('drops a canonical when its sourcePatternId matches a visible legacy row (no duplicate twin)', () => {
    const out = buildAvailablePatternOptions(
      [
        { id: 'legacy-1', name: 'Sweater', designer: 'Alice' },
      ],
      [
        // This canonical IS the twin of legacy-1 — must not appear.
        { id: 'cpm-twin-of-1', name: 'Sweater', sourcePatternId: 'legacy-1' },
        // This one is canonical-only — should be kept.
        { id: 'cpm-2', name: 'Designer-only chart', sourcePatternId: null },
      ],
    );
    expect(out.map((o) => o.id)).toEqual(['legacy-1', 'cpm-2']);
    expect(out.find((o) => o.id === 'cpm-twin-of-1')).toBeUndefined();
  });

  it('drops a canonical when its sourcePatternId is in attachedLegacyIds (alive twin attached via project_patterns even if soft-deleted upstream)', () => {
    // The user's `/api/patterns` list filters soft-deleted rows, but
    // `project.patterns[i]` still surfaces a project-attached row even
    // if its legacy was soft-deleted. The canonical's twin link points
    // at that attached id, so we drop it from the picker — the project
    // already has it via the attached legacy.
    const out = buildAvailablePatternOptions(
      /* legacy (full /api/patterns list) */ [],
      [{ id: 'cpm-attached-twin', name: 'Already attached', sourcePatternId: 'legacy-attached' }],
      /* attachedLegacyIds (project.patterns[i].id) */ ['legacy-attached'],
    );
    expect(out).toHaveLength(0);
  });

  it('keeps a canonical with a STALE link (sourcePatternId set, pointed-to legacy missing) so backend recovery can run', () => {
    // Canonical claims a back-link that isn't in the legacy list AND
    // isn't attached to the project. The pointed-to legacy is gone
    // (deleted, never existed for some reason). The backend
    // materializer's stale-link branch will recover this on attach by
    // inserting a fresh stub and overwriting source_pattern_id. Hiding
    // it here would orphan the canonical permanently.
    const out = buildAvailablePatternOptions(
      [],
      [{ id: 'cpm-stale', name: 'Recoverable', sourcePatternId: 'legacy-zombie' }],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'cpm-stale', kind: 'canonical' });
  });

  it('keeps a canonical-only pattern (sourcePatternId is null)', () => {
    const out = buildAvailablePatternOptions(
      [],
      [{ id: 'cpm-only', name: 'Designer-only', sourcePatternId: null }],
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'cpm-only', kind: 'canonical' });
  });

  it('handles a mixed list: visible-twin dropped, stale-link kept, canonical-only kept, attached-twin dropped', () => {
    const out = buildAvailablePatternOptions(
      [{ id: 'legacy-1', name: 'Visible legacy', designer: null }],
      [
        { id: 'cpm-visible-twin', name: 'Visible twin', sourcePatternId: 'legacy-1' },
        { id: 'cpm-stale', name: 'Stale link', sourcePatternId: 'legacy-zombie' },
        { id: 'cpm-only', name: 'Designer-only', sourcePatternId: null },
        { id: 'cpm-attached-twin', name: 'Attached twin', sourcePatternId: 'legacy-attached' },
      ],
      ['legacy-attached'],
    );
    expect(out.map((o) => o.id)).toEqual([
      'legacy-1',
      'cpm-stale',
      'cpm-only',
    ]);
  });

  it('preserves designer string when present, normalizes missing/undefined to null', () => {
    const out = buildAvailablePatternOptions(
      [
        { id: 'a', name: 'A', designer: 'Alice' },
        { id: 'b', name: 'B', designer: null },
        { id: 'c', name: 'C' },
      ],
      [],
    );
    expect(out[0].designer).toBe('Alice');
    expect(out[1].designer).toBeNull();
    expect(out[2].designer).toBeNull();
  });

  it('emits empty when both inputs are empty', () => {
    expect(buildAvailablePatternOptions([], [])).toEqual([]);
  });
});
