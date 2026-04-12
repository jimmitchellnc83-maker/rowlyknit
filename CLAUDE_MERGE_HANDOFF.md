# Message to give Claude now

Send Claude this exact message so he can finish the staged Codex-priority merge without losing anything and prove the broken features are fixed:

---

We already staged a no-commit merge on branch `remerge/codex-priority` (base: `origin/claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy`, merged in `origin/claude/investigate-sti-017gPERiqsqmDQFjEoRtQG5R`). You need to audit and finish it safely.

1) **Verify the branch and stage**
   - `git status -sb` should show `remerge/codex-priority` with the merge in progress and the `rowlyknit/` directory untracked (keep it untracked).

2) **Audit the staged diff (no deletions allowed)**
   - Overview: `git diff --cached --stat`
   - Confirm no deletions: `git diff --cached --name-status --diff-filter=D`
   - Focus review on the only modified files: `backend/Dockerfile`, `backend/package*.json`, `backend/src/app.ts`, `deployment/scripts/docker-deploy.sh`
   - Ensure all new controllers/services/migrations/seeds from Codex are present: `git diff --cached --name-status --diff-filter=A`

3) **Sanity checks**
   - `npm --prefix backend ls --depth=0`
   - `npm --prefix backend run build`
   - (Optional) `npm --prefix backend test -- --runInBand`

4) **Feature validation (prove fixes work)**
   - Transcription: run a sample audio through the job; confirm transcript saved and returned via API/UI.
   - Voice controls: run a multi-row session; confirm commands continue past row 2.
   - Magic markers: create via UI/API; verify persistence and retrieval.
   - Progress logging: log stitches/rows; verify DB/API/UI updates.
   - Export/import: export pattern (must be PDF); import from PDF (no JSON expectation).
   - Project types/stitch symbols/text notes: confirm enumerations appear in creation flows, symbols render in charts, and text notes link correctly.

5) **Share evidence and finish**
   - Send the command outputs and validation evidence above.
   - If all good, commit the merge: `git commit -m "Merge codex branch into investigate branch (audited)"`
   - If something is off, fix with `git checkout --ours/--theirs <path>` and rerun the audit before committing.

---

Once Claude returns the evidence or a committed branch, we can verify and promote to main.
