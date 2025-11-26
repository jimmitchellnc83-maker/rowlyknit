# Step 4: Validate the staged Codex-priority merge before committing

Use these commands on the staging branch (`remerge/codex-priority`) after the no-commit merge to ensure nothing was lost or overwritten before finalizing the merge commit.

## 1) Confirm branch state and merge parents
- Verify you are on the staging branch and still in a merge: `git status -sb`
- Record the parent tips for traceability:
  - `git rev-parse --short HEAD`
  - `git rev-parse --short origin/claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy`
  - `git rev-parse --short origin/claude/investigate-sti-017gPERiqsqmDQFjEoRtQG5R`
- Capture the merge base: `git merge-base --short origin/claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy origin/claude/investigate-sti-017gPERiqsqmDQFjEoRtQG5R`

## 2) Audit the staged diff (no files committed yet)
- Overview of all staged changes: `git diff --cached --stat`
- List deletions (should be empty): `git diff --cached --name-status --diff-filter=D`
- List modifications (only Dockerfile, package files, app.ts, deploy script expected):
  - `git diff --cached --name-status --diff-filter=M`
- Review each modified file to ensure Codex additions were not overwritten:
  - `git diff --cached backend/Dockerfile`
  - `git diff --cached backend/package.json backend/package-lock.json`
  - `git diff --cached backend/src/app.ts`
  - `git diff --cached deployment/scripts/docker-deploy.sh`
- Confirm all new files are the intended Codex additions (controllers, services, routes, migrations, seeds): `git diff --cached --name-status --diff-filter=A`

## 3) Quick functional sanity checks (without full test suite)
- Run dependency lock verification to ensure no unexpected version bumps: `npm --prefix backend ls --depth=0`
- Build the backend to catch obvious TypeScript/knex path issues: `npm --prefix backend run build`
- Optionally run lint/unit scope if available: `npm --prefix backend test -- --runInBand`

## 4) Finalize only after audit passes
- If the diff matches expectations and checks pass, create the merge commit: `git commit -m "Merge codex branch into investigate branch (audited)"`
- Tag the verified state for reference (optional): `git tag merge-audit-$(date +%Y%m%d)`
- Share the `git diff --cached --stat` and any check outputs as evidence that the merge preserved Codex features and did not overwrite existing work.

## 5) If issues are found
- Use `git checkout --theirs <path>` or `git checkout --ours <path>` to correct individual files without restarting the merge.
- Re-run Section 2 commands to confirm corrections before committing.
