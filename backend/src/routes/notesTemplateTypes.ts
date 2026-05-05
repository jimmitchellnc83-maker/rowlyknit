/**
 * `template_type` values allowed on `structured_memos` rows.
 *
 * Lives in its own file so unit tests can import the constant without
 * pulling the full notes route module — that module imports auth
 * middleware which itself requires `JWT_SECRET`, and a test process
 * shouldn't have to set that just to read a list of strings.
 *
 * Sprint 1 of the Public Tools Conversion engine added the
 * destination-aware values (`yardage_estimate`, `row_repeat_plan`,
 * `shaping_plan`, `stash_estimate`, `make_mode_reminder`) so a single
 * memo store can fan out to project / pattern / stash / Make Mode UI
 * surfaces in Sprint 2 by reading this column.
 *
 * Adding a new value here requires the matching value in the frontend
 * `templateTypeFor()` helper (see `frontend/src/lib/toolResult.ts`)
 * and the matching string in the contract test
 * `routes/__tests__/notesTemplateTypeEnum.test.ts`. Removing a value
 * is a breaking change for old memos and should run a migration that
 * backfills.
 */
export const ALLOWED_TEMPLATE_TYPES = [
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
] as const;
