# Post-push actions for `remerge/codex-priority`

Claude reported that the audited merge is committed at `6b6b86b` and already pushed. Use this checklist to finish the rollout safely.

## 1) Open the PR to `main` (optional but recommended)
- Ensure the local branch matches the pushed tip:
  - `git fetch origin`
  - `git checkout remerge/codex-priority && git reset --hard origin/remerge/codex-priority`
- Create the PR from `remerge/codex-priority` into `main` so the additive diff stays reviewable and traceable.
- Include in the PR description:
  - Merge summary: 33 new files, 7 modified files (additive), build clean.
  - Commit reference: `6b6b86b`.
  - Testing plan below for reviewers.

## 2) Deploy for feature-validation testing (Step 4 in Codex plan)
- Deploy the pushed branch to the staging/test environment used for prior regressions.
- After deploy, run the full regression set end-to-end:
  - Audio transcription produces transcripts and persists them.
  - Voice controls function past the first two rows in a session.
  - Magic markers can be created and retrieved.
  - Progress logging records stitches/rows and surfaces via API/UI.
  - Pattern export returns PDF (not JSON); chart import accepts PDF (not JSON).
  - Project types appear where expected; stitch symbols render in charts.
  - Text notes link to their targets.
- Capture evidence for any failures: endpoint, payload, logs, and screenshots if applicable.

## 3) Bugfix flow if validation finds issues
- Keep `remerge/codex-priority` pristine; branch from it for each fix (e.g., `remerge/bugfix-<issue>`).
- Patch, test, and PR fixes back into `remerge/codex-priority`, then redeploy and rerun the failing checks.
- Once the regression set passes, promote the branch (or merged PR) to `main` and proceed to production rollout.

This keeps the audited merge intact while providing a clear path to validate and promote the code.
