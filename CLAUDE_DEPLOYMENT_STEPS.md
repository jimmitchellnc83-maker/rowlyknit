# Claude deployment handoff steps

Use this to finish the Codex-priority merge that is staged in `remerge/codex-priority` and get it ready for user testing.

## 1) Verify the merge branch
- Check out the branch and confirm the audited commit is present:
  - `git checkout remerge/codex-priority`
  - `git show --stat 6b6b86b`
- Ensure the working tree is clean before pushing:
  - `git status --short`

## 2) Push the branch to the remote
- Push the verified branch for review and deployment:
  - `git push origin remerge/codex-priority`
- If your remote requires tracking, add `-u` on the first push.

## 3) Optional: open a PR to `main`
- Create a pull request from `remerge/codex-priority` into `main` (or the target release branch) so the diff stays visible for review.
- Include the audited merge summary (33 new files, 7 modified, additive changes, build clean) in the PR description.

## 4) Deploy for feature validation
- Deploy the pushed branch to the test environment used for the earlier regression checks.
- Re-run the broken-feature validation set: transcription, voice controls beyond 2 rows, magic markers creation, progress logging, pattern export (PDF), chart import (PDF), project types, stitch symbols, text-note linking.
- Capture any failures with logs and endpoints so we can patch regressions quickly if they remain.

## 5) If issues appear
- Keep `remerge/codex-priority` unchanged; branch off it for fixes (e.g., `remerge/bugfix-<issue>`).
- Patch and open PRs back into `remerge/codex-priority`, then retest.

These steps keep the audited merge intact while getting the code into a deployable state for full feature verification.
