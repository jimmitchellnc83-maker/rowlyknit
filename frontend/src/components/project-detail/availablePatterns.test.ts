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
 * The helper drops any canonical with `sourcePatternId !== null`,
 * regardless of whether the pointed-to legacy row is in the legacy list
 * (a defensive choice — if the legacy is missing for any reason, the
 * user can still re-attach via the legacy picker after we backfill it,
 * and this avoids leaking a "ghost canonical" pick that would route to a
 * different code path on the backend).
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

  it('drops canonical patterns whose sourcePatternId is set (no duplicate twin in the picker)', () => {
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
    // Specifically: the twin canonical is NOT present.
    expect(out.find((o) => o.id === 'cpm-twin-of-1')).toBeUndefined();
  });

  it('drops the canonical even when the linked legacy is not in the list (defensive — never leak a phantom canonical pick)', () => {
    // Canonical claims a back-link that isn't represented in the legacy
    // list (could be soft-deleted, or just not yet refreshed). The
    // helper still drops it — letting it through would route to the
    // canonical attach branch but the user thinks they're picking a
    // standalone canonical, which it isn't.
    const out = buildAvailablePatternOptions(
      [],
      [{ id: 'cpm-orphan', name: 'Orphan', sourcePatternId: 'legacy-missing' }],
    );
    expect(out).toHaveLength(0);
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
