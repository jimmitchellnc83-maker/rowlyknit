# Guided Knitting Release — QA flows

Manual end-to-end test steps for the five flows defined in
`02-rowly-guided-knitting-flows.md`. Each section contains the steps
and the visible-result checks that prove the flow works in production.

These are the canonical regression checks for any change touching
Make Mode, source files, QuickKeys, chart assistance, or panel
continuity. Run all five before tagging a deploy as complete.

Automated smoke coverage for the new components lives next to the
implementation files (`*.test.tsx`). A future Playwright suite should
codify the flows below; until that lands, this doc is the source of
truth.

---

## Flow 1 — Resume knitting from an in-progress project

**Goal:** A logged-in user finds the active knitting workspace from a
project page without needing the URL.

1. Log in to `https://rowlyknit.com`.
2. Click **Projects** in the nav.
3. Open any in-progress project.
4. **Check:** the header shows a primary purple **"Resume Knitting"**
   button (not the old gray "Knitting Mode" label).
5. Click **Resume Knitting**.
6. **Check:** the page swaps into Make Mode layout — counters, marker
   state, session timer, pieces strip (if pieces exist), QuickKeys
   panel (if any saved). The toast reads "Make Mode activated! 🧶".
7. Close the browser tab. Return later, navigate back to the same
   project. **Check:** Make Mode auto-restores (the per-project
   knitting-mode preference persists via `localStorage`).

---

## Flow 2 — Open a pattern and work with source files correctly

**Goal:** Source files for a pattern default to that pattern's scope,
not a global file dump.

1. From **Patterns**, open any pattern.
2. Click the **Sources** tab.
3. **Check:** the file list shows only files attached to this pattern
   (via `pattern_crops` linkage). It should NOT show files attached
   only to other patterns.
4. Upload a new PDF or image. **Check:** it appears in the list.
5. Drag a crop on the PDF, save it. **Check:** it persists.
6. If the file is also attached to another pattern (via crops), an
   amber **"Shared"** badge appears next to the filename.

---

## Flow 3 — Use QuickKeys while knitting

**Goal:** Saved QuickKey crops are reachable from active knitting and
opening one doesn't lose row state.

1. From a pattern's **Sources** tab, draw a crop, save it, and click
   the star ★ to mark it as a QuickKey.
2. Open the project that uses this pattern. Enter Make Mode.
3. **Check:** the sidebar contains a **"QuickKeys (N)"** panel listing
   the saved QuickKey by label + page number.
4. Note the current row counter value.
5. Click a QuickKey row.
6. **Check:** a modal opens showing the source PDF page with the crop
   region highlighted in amber.
7. Close the modal.
8. **Check:** Make Mode is still on the same row, marker state
   unchanged, no route navigation occurred.

---

## Flow 4 — Use chart assistance in a real workflow

**Goal:** Visible chart-assistance UI lets the user align a grid,
sample a symbol, and see meaningful match results.

1. Open a pattern with at least one chart-containing PDF crop.
2. In **Sources**, find the crop in the list. Click the **⬚** (chart
   assistance) icon.
3. **Check:** a modal opens showing the PDF page with the crop
   rectangle outlined in amber.
4. In the side panel, enter `cells across` and `cells down` (or use
   the defaults), then click **"Save grid"**.
5. **Check:** a clickable cell grid overlays the crop region.
6. Click a grid cell. When prompted, type a chart symbol (e.g.,
   `k` or `yo`).
7. **Check:** the cell turns amber. The sample appears in the
   Magic Marker side panel with the symbol + cell coordinates.
8. Click **"Find similar to last sample"**.
9. **Check:** any matching cells turn purple. The status line shows
   the match count.

---

## Flow 5 — Knit across panels or pieces

**Goal:** From Make Mode, the user can identify the active piece and
reach Panel Knitting without backing out.

1. Open a project that has multiple pieces.
2. Mark one piece as `In progress` from the regular project view.
3. Enter Make Mode.
4. **Check:** the sidebar contains a **"Pieces (N)"** panel.
5. **Check:** the in-progress piece is highlighted with a purple dot
   and accent border. The "Active: <name>" line is above the list.
6. If the project has panel groups, the panel header shows a
   **"Panel Knitting →"** link.
7. Click that link. **Check:** PanelHub opens. Pick a panel group,
   tap into Panel Knitting view.
8. Increment the master counter. Switch panels.
9. **Check:** each panel retains its own row state across switches.
10. Back out to the project. **Check:** the project's piece status
    reflects any changes you made in Panel Knitting.

---

## Regression spot-checks

After running the five flows, verify these unchanged behaviors:

- [ ] Existing Project list / pattern list / yarn stash navigate normally.
- [ ] Existing Counter ± behavior in non-Make-Mode view still works.
- [ ] Source-file upload + delete still work outside the new scoping flow.
- [ ] PDF viewer renders correctly (no react-pdf regressions).
- [ ] `/patterns/:id/make` and `/patterns/:id/author` are reachable for
      authenticated users (no flag-disabled message).
- [ ] Landing page (logged out) reads "Make Mode" not "Knitting Mode".
