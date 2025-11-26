# Next Steps to Recover the Functional App

Use this checklist to proceed now that the Codex work has been partially merged and key features are broken.

## 1) Rehydrate Both Branch Tips Locally
- Add the remotes that contain `claude/investigate-sti-017gPERiqsqmDQFjEoRtQG5R` and `claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy` (or fetch them if already configured).
- Verify the tip commits exist locally and note their SHAs (expected deploy tip: `70ecf4a`).
- Create local tracking branches for both tips so you can diff without altering main.

## 2) Protect Main and Create a Recovery Workspace
- Branch from the deployed tip: `git checkout -b recovery/deploy-tip 70ecf4a`.
- Freeze main by avoiding direct commits there until reconciliation is done.
- Optional safety: tag the current main tip for easy rollback.

## 3) Compare and Stage the Right Sources
- Generate a structured diff between the Codex branch and the deployed tip: `git diff 70ecf4a...claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy`.
- List files only changed by the Codex branch to target restorations: `git diff --name-only 70ecf4a...claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy`.
- For binary assets (e.g., PDFs, stitched symbols), use `git show` or `git restore -s` to pull the Codex versions into the recovery branch.

## 4) Reapply Codex Implementations Carefully
- For each divergent file, prefer the Codex implementation unless the deployed tip contains fixes the Codex branch lacks; merge those fixes manually.
- Avoid blind copying: inspect service/controller wiring, routes, and module exports to keep everything connected.
- When unsure, stage Codex code then re-apply specific deployed fixes on top.

## 5) Re-run Wiring and Migrations Checks
- Confirm services are registered where expected (dependency injection containers, module imports, router mounts, background job schedulers).
- Verify database migrations: ensure 37 migrations are present and applied in the recovery environment; backfill any new columns required by Codex features (operator, transcription fields, project types, stitch symbols).

## 6) Functional Verification (focus on previously broken areas)
- Audio: ensure transcription pipeline produces transcripts end-to-end; test upload → processing → persistence.
- Voice controls: validate continuous operation beyond two rows; watch for event listeners or throttling logic regressing.
- Magic markers: create markers and confirm DB/state updates and UI reflections.
- Progress logging: check that counters increment and persist; ensure background jobs append logs.
- Pattern export/import: confirm export outputs PDF (not JSON) and import expects PDF; verify MIME/type handling and controller responses.
- Project types and stitch symbols: check enumerations/constants and seed data; ensure UI renders symbols where expected.
- Text notes: verify relational links and UI navigation from notes back to associated entities.

## 7) Regression Tests and Smoke Checks
- Run automated suites available in the repo (backend + frontend) on the recovery branch.
- Execute manual smoke tests for each critical flow above; capture logs for any failures.

## 8) Promote the Fixed Branch
- Once validations pass, merge the recovery branch into main with a reviewed PR.
- Tag the merged commit and deploy from that tag to keep parity between code and production.
