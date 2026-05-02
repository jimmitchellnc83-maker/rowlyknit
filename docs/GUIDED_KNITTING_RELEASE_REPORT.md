# Rowly Guided Knitting Release Report

Release window: 2026-05-02
Operator brief: `04-rowly-claude-code-operator-brief.md`
PRD pack: `01`–`04` Guided Knitting docs

This report follows the format defined in operator brief doc 04.

---

## 1. Completed and live

User-facing improvements now available on `rowlyknit.com`:

- **Make Mode promotion.** "Knitting Mode" renamed to "Make Mode" everywhere users see it (project header, onboarding card, counter empty states, marker walkthrough, landing pillar). Project header CTA upgraded from a low-contrast gray "Knitting Mode" toggle to a primary purple **"Resume Knitting"** button. (PR #345)
- **Designer modes unflagged.** Both `VITE_DESIGNER_MAKE_MODE` and `VITE_DESIGNER_AUTHOR_MODE` flags dropped — `/patterns/:id/make` and `/patterns/:id/author` now reachable for any authenticated user. PatternDetail action row gained Make Mode + Author Mode buttons. (PR #345)
- **Source files scoped to current pattern.** Sources tab no longer dumps the user's whole file library; it shows only files attached to the current pattern via crops. Reused files badged "Shared" so multi-pattern attachments are visible, not accidental. (PR #346)
- **QuickKey consumption.** Make Mode sidebar now hosts a QuickKeys panel that lists the pattern's saved QuickKey crops; tapping one opens an in-place modal with the source PDF page + crop highlight, no navigation, row state preserved. (PR #347)
- **Visible chart assistance UI.** Each saved crop in `SourceFilePdfViewer` now has a ⬚ button that opens a chart-assistance modal — set grid alignment (cells across/down + bbox), tap a cell to tag it with a symbol, "Find similar" highlights matched cells using a client-side perceptual dHash that mirrors the backend hash byte-for-byte. (PR #348, on top of migration #075)
- **Join layouts + blank pages.** New "Layouts & Pages" section on ProjectDetail (between Markers and Sessions) lists both surfaces with create/delete affordances. Blank pages open a full HTML5 canvas drawing modal with pen, color palette, width slider, save/clear. (PR #349, on top of migration #076)
- **Panel continuity in Make Mode.** Pieces strip in the Make Mode sidebar shows the active in-progress piece highlighted, status pills for each piece, and a "Panel Knitting →" link to PanelHub when panel groups exist. (PR #350)
- **Verification harness.** 8 component smoke tests + a manual QA doc with the five flows from spec doc 02 + a regression spot-check list. (PR #351)

---

## 2. Verified flows

| Flow | Verified where | Result |
|---|---|---|
| Resume knitting from in-progress project | Component test for `ProjectHeader` + manual flow doc | Code path verified, type-checked, smoke test passes |
| Source files scoping (default lists current pattern) | Backend service test for `listSourceFilesForUser` (32 tests) + scoping verified in `SourceFilesPanel` props | Code path verified |
| QuickKey consumption in Make Mode | `QuickKeysPanel.test.tsx` (3 tests, empty + loaded + tap-opens-modal) | Verified |
| Chart assistance (alignment + sample + find similar) | dHash format verified to match backend `magicMarkerService#computeDHash`; full UI lives in `ChartAssistanceModal` | Code path verified; manual flow documented |
| Panel switching from Make Mode | `PiecesQuickPanel.test.tsx` (3 tests, empty + active-piece + panel-link) | Verified |

`npx tsc --noEmit` clean across backend + frontend. 32 backend tests + 8 new frontend smoke tests pass.

Live bundle grep on `rowlyknit.com` (post-PR-#352 deploy) confirmed every in-scope user-facing string is present and zero "Knitting Mode" strings remain — see section 4.

---

## 3. Bugs debugged and fixed

- **Source-file list was a global file dump.** `listSourceFiles()` was called with no scope from `SourceFilesPanel`, returning every file the user owned regardless of the pattern context. Fixed by adding a `patternId` filter to `listSourceFilesForUser` (joins on `pattern_crops` via `WHERE EXISTS`) and passing the panel's own `patternId`. PRD doc 03 explicitly classified this as a release anti-pattern.
- **QuickKeys were create-only.** Toggling the star on a crop in `SourceFilePdfViewer` flipped `is_quickkey: true` and nothing read it. Backend `listQuickKeysForPattern` had to grow new fields (`sourceFileId`, normalized crop rect) so a consumer could render the saved snippet without re-fetching the crop. New `QuickKeysPanel` consumes the endpoint.
- **Chart assistance was backend-only.** Migration #075 + the chart alignment / Magic Marker service shipped weeks ago with no UI. New `ChartAssistanceModal` provides the full alignment + sample + find-similar workflow.
- **Wave 6 was backend-only.** Migration #076 + the join layouts / blank pages services had no UI surface. New `LayoutsAndPagesSection` on ProjectDetail provides list + create + canvas drawing.
- **Make Mode was hidden behind a feature flag.** Both designer routes returned a "Mode is disabled" screen unless `VITE_DESIGNER_MAKE_MODE` / `VITE_DESIGNER_AUTHOR_MODE` were set. Flags + helper file deleted; routes are now reachable for any authenticated user.

---

## 4. Deploy/publish status

- **Deploy mechanism:** push-to-`main` triggers `.github/workflows/deploy-production.yml` (prod auto-deploy live since 2026-04-27).
- **Workflow runs:** eight deploys queued, one per merged PR (#345 through #352). Earlier runs were superseded/cancelled by newer commits — expected with rapid sequential merges.
- **PR #351 deploy failed** with `TS6133: 'waitFor' is declared but its value is never read` in `LayoutsAndPagesSection.test.tsx`. Local `tsc --noEmit` had passed; the docker build's `npm run build` caught it. The site went 502 because the deploy stopped the old container before the new one finished building. Recovered by `ssh rowly && docker start rowly_frontend` to restore the prior bundle (which already contained PRs #345–#349). PR #352 dropped the unused import; that deploy succeeded.
- **Final deploy:** run `25260967477` (PR #352) succeeded. New frontend container `rowly_frontend` (Up, healthy). Bundle hash changed from `index-D-B1f51N.js` → `index-Ch2kvsoL.js`, confirming the new build is being served.
- **Live bundle grep verified all in-scope features ship:**

  | String | Count |
  |---|---|
  | "Make Mode" | 12 |
  | "Resume Knitting" | 1 |
  | "QuickKeys" | 4 |
  | "Chart assistance" | 1 |
  | "Magic Marker" | 10 |
  | "Find similar" | 1 |
  | "Layouts & Pages" | 1 |
  | "Panel Knitting" | 2 |
  | "Pieces (" | 1 |
  | "Active:" | 6 |
  | "Knitting Mode" | **0** |

- `/patterns/<id>/make` returns HTTP 200 (no flag-disabled message). Auth-required UI flows in `docs/GUIDED_KNITTING_QA.md` for owner walk-through; Claude does not hold credentials.

---

## 5. Remaining blockers

None block this release. Followups identified that don't block ship:

- **Playwright integration suite** — the Vitest smoke tests + manual QA doc cover the regression surface, but a real Playwright suite (browser binaries + auth seed bootstrap) is the cleaner long-term option.
- **Drag-drop region editor for join layouts** — current PR creates named layouts; wiring the canvas-drag region editor is a follow-up.
- **Symbol picker dropdown** for chart assistance — current PR uses a free-form `prompt()`; a `chart_symbol_templates`-backed picker is a cleaner UX iteration.
- **`/p/:slug` server-side OG cards** for the new modes (existing followup carried over from the pre-launch backlog, unrelated to this release).
