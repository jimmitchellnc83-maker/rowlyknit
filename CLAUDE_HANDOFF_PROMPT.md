# Prompt for Claude to support recovery and merge validation

Use this prompt verbatim when asking Claude to supply the missing materials and run the controlled recovery. It avoids file-copy overwrites and focuses on verifiable outcomes for every previously broken feature.

---

**Context**
- We need to reconcile deployed commit `70ecf4a` (branch `claude/investigate-sti-017gPERiqsqmDQFjEoRtQG5R`) with the Codex branch `claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy`.
- Past attempts copied files and skipped full validation, leaving transcription, voice controls, magic markers, progress logging, export/import, project types, stitch symbols, and text-note linking broken.

**What I need from you (Claude)**
1) **Provide branch artifacts**
   - Push both branch tips to our shared remote or export bundles:
     - `git bundle create deployed.bundle 70ecf4a`
     - `git bundle create codex.bundle claude/build-rowly-production-app-011CV32EASvp9cQ2Z8eA8mTy`
   - Share any environment secrets/configs needed for transcription, PDF rendering, and voice features so validation is realistic.

2) **Set up a clean recovery workspace**
   - `git checkout -b recovery 70ecf4a`
   - Add/fetch the Codex tip from the bundles or remote.
   - Do **not** copy whole files over existing ones; use diffs to restore only missing pieces.

3) **Controlled diff and restore**
   - Run: `git diff recovery..codex -- backend frontend docs` to see deltas.
   - For each feature area, cherry-pick or checkout the specific paths from Codex, then resolve conflicts consciously:
     - Transcription pipeline wiring
     - Voice controls beyond 2 rows
     - Magic marker creation and persistence
     - Progress logging (rows/stitches)
     - Pattern export (PDF output) and import (PDF input, not JSON)
     - Project types and stitch symbol enumerations
     - Text-note linking to the correct entities
   - Re-run migrations if models differ and ensure controllers → services → repositories wiring is intact after each restore.

4) **Validation pass (must demonstrate end-to-end)**
   - Transcription: run a sample audio through the job; confirm transcript is saved and returned via API/UI.
   - Voice controls: run a multi-row session; confirm commands continue past row 2.
   - Magic markers: create via UI/API; verify persistence and retrieval.
   - Progress logging: log stitches/rows; verify DB/API/UI reflect updates.
   - Export/import: generate pattern export (PDF); import from PDF; ensure no JSON expectation remains where PDF is required.
   - Project types/stitch symbols/text notes: confirm enumerations appear in creation flows, symbols render in charts, and text notes are linked correctly.

5) **Deliverables back to me**
   - A PR or branch with all restored fixes and migrations applied.
   - A short test log or screenshots demonstrating each validation bullet above.
   - Notes on any conflicts you resolved or places where Codex code was superseded by deployed fixes.

**Key rules**
- No wholesale file overwrites; restore with intent.
- Confirm wiring and migrations after each restored area.
- Show evidence (logs/screens) for each feature.

---

Send me the branch artifacts, validation evidence, and the resulting recovery branch. I’ll verify and promote to main once your checks pass.
