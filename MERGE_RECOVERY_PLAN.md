# Re-merge recovery plan

## Goal
Reconstruct the full, functioning feature set by cleanly re-merging the Codex implementation (`claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy`) with the currently deployed branch (`claude/investigate-sti-017gPERiqsqmDQFjEoRtQG5R`, commit `70ecf4a`), avoiding file overwrites and validating end-to-end behavior.

## Prerequisites
- Access to both branch tips via remotes (add or fetch as needed).
- A clean working tree on `main` (or your target integration branch).
- Database available with migrations applied for feature verification.

## Recommended workflow
1. **Sync remotes**
   ```bash
   git remote -v
   git remote add upstream <url-containing-claude-branches>  # if missing
   git fetch --all --prune
   ```

2. **Create integration branch from Codex baseline**
   ```bash
   git checkout claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy
   git checkout -B remerge/codex-priority
   ```
   This keeps Codex behavior intact while pulling in the deployed branch.

3. **Merge deployed branch without auto-commit**
   ```bash
   git merge --no-commit --no-ff claude/investigate-sti-017gPERiqsqmDQFjEoRtQG5R
   ```
   - Resolve conflicts manually, preferring Codex behavior when in doubt.
   - Avoid wholesale file replacements; review hunks to keep Codex logic and incorporate new fields (e.g., operator/transcription additions).

4. **Audit divergences before committing**
   ```bash
   git diff --stat
   git diff --name-only --diff-filter=U  # ensure no unresolved conflicts
   ```
   - For unchanged-but-suspect files (services/controllers), compare explicitly:
     ```bash
     git diff claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy...claude/investigate-sti-017gPERiqsqmDQFjEoRtQG5R -- <path>
     ```
   - Reintroduce lost wiring by cross-checking module exports, DI bindings, and route registrations rather than copying files wholesale.

5. **Commit the reconciled merge**
   ```bash
   git status
   git commit
   ```
   Ensure the message notes Codex-priority reconciliation.

## Feature verification checklist
Run targeted checks to confirm previously broken areas are restored:
- **Audio transcription**: end-to-end job triggers, storage of transcript text, and UI display. Validate background worker and webhook callbacks if applicable.
- **Voice controls**: confirm command handling continues beyond two rows; test rapid consecutive inputs.
- **Magic markers**: create/update flows and persistence; ensure controller-service wiring and IDs align with DB schema.
- **Progress logging**: verify events are recorded and surfaced in UI; confirm timestamps and associations are correct.
- **Pattern export**: ensure PDF generation is wired instead of JSON; inspect MIME type and route handlers.
- **Chart import**: confirm parser expects PDF (or desired format) and rejects incorrect JSON paths.
- **Project types & stitch symbols**: check seed data/enums and rendering locations; ensure migrations align.
- **Text notes linking**: verify note-to-entity relationships and UI references.

Recommended test pass (adapt commands to project tooling):
```bash
# backend
npm test -- workspaces=backend   # or equivalent test runner

# frontend
npm test -- workspaces=frontend
npm run lint
npm run build
```

Document any intentional behavioral changes before pushing the merge.
