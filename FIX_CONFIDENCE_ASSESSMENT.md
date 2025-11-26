# Remediation Confidence & Path to Resolution

## Confidence Statement
We can restore full functionality by replaying the Codex branch changes with a controlled merge and validation loop. The codebase already contains the documented API and frontend surface from `main`, along with deployment scripts and migration history, so recovery is a matter of aligning branches and re-verifying feature behaviors.

## Why This Is Achievable
- **Clear baselines:** Existing reports (`MAIN_BRANCH_REPORT.md`, `MERGE_RECOVERY_PLAN.md`) outline the current backend and frontend surfaces plus a tested recovery workflow.
- **Deterministic migrations:** All 37 migrations have been applied; schema drift risk is low, letting us focus on service wiring and behavior verification.
- **Isolated problem areas:** The regressions are scoped (transcription, voice control, markers, exports/imports, logging, project types, stitch symbols, text notes), allowing targeted diffs and tests.

## Immediate Actions
1. **Fetch missing branch tips** referenced in the recovery plan so we can run `git diff` across `claude/investigate-sti-017gPERiqsqmDQFjEoRtQG5R` and `claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy` locally.
2. **Rebase or rerun merge** following `MERGE_RECOVERY_PLAN.md`, preferring replaying Codex commits on top of the deployed branch to preserve fixes while restoring lost code paths.
3. **Targeted verification** of the reported regressions using the checklist in the recovery plan (audio transcription end-to-end, voice controls row traversal, marker creation, progress logging, export/import formats, project types, stitch symbol coverage, and text note linkage).
4. **Wire-up audit** to confirm services/controllers are connected (DI bindings, route registrations, and background workers) and that feature flags/config match expectations.
5. **Integration test pass** (API + UI smoke) before final deploy.

## Dependencies & Information Needed
- Remote access to the two branch heads (or patches) so we can diff and cherry-pick with fidelity.
- Any environment-specific configs or secrets required to exercise audio transcription and PDF export/import locally.
- Confirmation of expected PDF schema for exports/imports and the canonical project type/stitch symbol lists.

## Proposed Success Criteria
- All regressions you listed are validated as working in staging after merge replay.
- No open 500s or missing routes in API gateway logs during the test pass.
- Pattern export/import produce PDFs with correct schema; charts accept PDFs as input without manual conversion.
- Audio transcription yields transcript artifacts and voice controls operate beyond two rows.
- Magic markers, progress logging, project types, stitch symbols, and text note linkage behave as documented in the Codex branch.

## Next Step
Share the branch tips or patches for the two branches so we can begin the controlled re-merge and verification cycle. With that information, we can execute the recovery plan and restore full functionality.
