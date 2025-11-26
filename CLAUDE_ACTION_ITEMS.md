# Claude action items to finish the Codex-priority merge

Use these steps directly on the `remerge/codex-priority` branch that already has the no-commit merge staged.

1. **Confirm you are in the staged merge**
   - `git status -sb` should show `remerge/codex-priority` and "all conflicts fixed but you are still merging".
   - Keep the untracked `rowlyknit/` directory out of the commit; it should stay untracked.

2. **Run the audit from `MERGE_VALIDATION_CHECKLIST.md` (Step 4)**
   - Diff overview: `git diff --cached --stat`.
   - Verify no deletions: `git diff --cached --name-status --diff-filter=D` (should be empty).
   - Review the only modified files: `backend/Dockerfile`, `backend/package*.json`, `backend/src/app.ts`, `deployment/scripts/docker-deploy.sh`.
   - Confirm the added controllers/services/routes/migrations/seeds are present via `git diff --cached --name-status --diff-filter=A`.

3. **Light sanity checks before committing**
   - Dependency tree: `npm --prefix backend ls --depth=0`.
   - TypeScript/build: `npm --prefix backend run build`.
   - Optional quick tests (if available): `npm --prefix backend test -- --runInBand`.

4. **Share evidence and commit only if the audit passes**
   - Paste the outputs for the diff commands and any checks above so we can confirm nothing was lost.
   - If everything matches expectations, finish the merge: `git commit -m "Merge codex branch into investigate branch (audited)"`.
   - If something is off, correct with `git checkout --ours/--theirs <path>` and rerun the audit before committing.
