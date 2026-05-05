/**
 * Sprint 1 Public Tools Conversion — backend templateType enum.
 *
 * The frontend `templateTypeFor()` helper ships values that depend on
 * this list staying in sync. Failure mode if these drift: a logged-in
 * user clicks "Save to Rowly," the picker posts `templateType:
 * yardage_estimate`, and the API returns 400 "Invalid value" — silently
 * burning the conversion. This contract test pins both sides.
 *
 * The test reads the route's exported `ALLOWED_TEMPLATE_TYPES`
 * (added in the same commit that introduced the new enum values) and
 * asserts every value the frontend can emit is present.
 */

import { ALLOWED_TEMPLATE_TYPES } from '../notesTemplateTypes';

const FRONTEND_TEMPLATE_TYPES = [
  'gauge_swatch',
  'fit_adjustment',
  'yarn_substitution',
  'finishing',
  'finishing_techniques',
  'calculator_result',
  // Sprint 1 — Public Tools Conversion
  'yardage_estimate',
  'stash_estimate',
  'row_repeat_plan',
  'shaping_plan',
  'make_mode_reminder',
];

describe('notes route — templateType enum contract', () => {
  it('exports ALLOWED_TEMPLATE_TYPES from the sidecar module', () => {
    expect(Array.isArray(ALLOWED_TEMPLATE_TYPES)).toBe(true);
    expect(ALLOWED_TEMPLATE_TYPES.length).toBeGreaterThan(0);
  });

  it('contains every templateType the frontend can emit (Sprint 1 + legacy)', () => {
    // Widen to Set<string> so the test can probe with arbitrary
    // strings (the route's `as const` array narrows the element type
    // to a tight union and would otherwise reject the lookup at the
    // type level).
    const allowed = new Set<string>(ALLOWED_TEMPLATE_TYPES);
    for (const t of FRONTEND_TEMPLATE_TYPES) {
      expect(allowed.has(t)).toBe(true);
    }
  });

  it('includes the four Sprint 1 destination-aware values', () => {
    const allowed = new Set<string>(ALLOWED_TEMPLATE_TYPES);
    for (const t of [
      'yardage_estimate',
      'row_repeat_plan',
      'shaping_plan',
      'make_mode_reminder',
    ]) {
      expect(allowed.has(t)).toBe(true);
    }
  });

  it('rejects an obviously-bad templateType', () => {
    const allowed = new Set<string>(ALLOWED_TEMPLATE_TYPES);
    expect(allowed.has('drop_table')).toBe(false);
    expect(allowed.has('')).toBe(false);
    expect(allowed.has('arbitrary_user_input')).toBe(false);
  });
});
