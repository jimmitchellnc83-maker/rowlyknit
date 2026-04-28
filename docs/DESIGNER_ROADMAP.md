# Designer 2.0 + Crochet — Roadmap

> **⚠️ PAUSED 2026-04-27.** Sessions 6a–15 of this roadmap are no longer the next-up plan. The owner authored a broader product vision in `docs/PATTERN_DESIGNER_PRD.md` that calls for a **schema-first rebuild** around a canonical Pattern model with three synchronized modes (Design / Author / Make), not incremental feature additions on top of the current form-first Designer. See `docs/PATTERN_DESIGNER_GAP_ANALYSIS.md` for the rebuild plan.
>
> Sessions 1–5 are still **shipped** — their code is part of the "Keep" column in the gap analysis. The remaining sessions (6a–15) will be folded into the new rebuild's PRs as they map (e.g. cardigan front pieces becomes a Section template, multi-size schema becomes part of Pattern model). Don't pick up a session from this doc cold — start from the PRD + gap analysis instead.

---

This is the full roadmap for taking Rowly's Pattern Designer from a strong parametric drafter into a full publishing-grade design environment, with crochet support baked in from the foundation rather than retrofitted.

Each row in the high-level map below is **one session** — a scoped chunk of work that opens, merges, deploys, and smoke-tests before the next session starts. Sessions are written so a fresh Claude Code session can pick one up cold.

## Guiding principles

- **Crochet baked in from session 1, not retrofitted.** Schema, palette, instruction vocabulary, glossary all carry the `craft` field from the first migration.
- **Migrations land alone within their session.** A session may contain 1–3 PRs but always merges its migration before the UI PR built on it.
- **Each session ends in production.** Merge + deploy + smoke-test before declaring done.
- **No skipping ahead.** Sessions follow the dependency chain. If a session unblocks itself early, the leftover work rolls into the next one — don't cherry-pick.

## High-level map

| # | Session | Outcome | Depends on | Approx. effort |
|---|---|---|---|---|
| 1 | Stitch foundation (knit + crochet) | Custom stitches, both crafts, multi-cell, full palette UI | — | 2 PRs / ~2 days |
| 2 | Chart-to-text + glossary | Chart produces readable written instructions; print view has glossary | 1 | 2 PRs / ~2 days |
| 3 | Publishing-copy export | Sellable PDF with metadata + sectioned layout | 2 | 2 PRs / ~1 day |
| 4 | Chart asset library | Charts are reusable across drafts; image/PDF export wired | 1 (uses stitch model) | 2 PRs / ~2 days |
| 5 | Yarn requirements estimate | Designer drafts include yardage by color | 1 | 1 PR / ~1 day |
| 6a | Cardigan front pieces | Cardigan as a first-class shape (knit) | 1 | 1 PR / ~2 days |
| 6b | Top-down raglan (pullover + cardigan) | Raglan construction, knit | 6a | 1 PR / ~2 days |
| 6c | Circular yoke (pullover + cardigan) | Yoke construction with chart placement | 6b | 1 PR / ~3 days |
| 7 | Construction direction toggle | Top-down/bottom-up on existing shapes | 6c | 1 PR / ~1 day |
| 8 | Hand vs. machine across all presets | Machine knitters get full preset support | 7 | 1 PR / ~1 day |
| 9 | Standard size libraries (CYC) | One-click "Adult M sweater" measurements | — (parallel) | 1 PR / ~½ day |
| 10a | Multi-size schema + UI | Define multiple sizes in one draft | 6c, 9 | 1 PR / ~2 days |
| 10b | Multi-size print output | Inline size notation + size table | 10a | 1 PR / ~2 days |
| 11 | Crochet garment engine | Crochet-specific shape math (turning chains, joined rounds, motif assembly) | 6c, 10b | 2 PRs / ~3 days |
| 12 | Text-to-chart parser | Paste written instructions → get chart | 2 | 1 PR / ~2 days |
| 13 | Designer ↔ calculators integration | Gauge / Gift Size deep-link into Designer | 1 | 1 PR / ~1 day |
| 14 | Designer ↔ stash integration | Pull yarn from stash; deduct on save | 5 | 1 PR / ~1 day |
| 15 | Section-vocabulary expansion (Custom Draft) | New section types based on knitter feedback | — (parallel) | 1 PR / ~1 day |

**Total:** ~21 PRs, ~6–8 weeks at one session per working day.

---

## Session 1 — Stitch foundation (knit + crochet)

**Goal:** Stitches become rich data — abbreviation, RS/WS instructions, cell span, craft. Crochet seeded alongside knit. Designer UI for authoring custom stitches.

**PRs:**
1. **Schema + backfill + API.** Migration adds `abbreviation`, `rs_instruction`, `ws_instruction`, `cell_span`, `craft` to `chart_symbol_templates`. Backfills knit system stitches. Seeds crochet system stitches (~26 rows). New `chartSymbolService.ts` + `GET/POST/PUT/DELETE /api/charts/symbols` with palette grouping and `?craft=` filter. Tests.
2. **Designer stitch UI.** Craft toggle in header. `StitchPalette.tsx` regrouped (System / My stitches / Recent / Used). `CustomStitchModal.tsx`. Curated symbol library (~120 inline SVGs covering knit + crochet). Multi-cell rendering in `ChartGrid.tsx` and `ChartOverlay.tsx`.

**Definition of done:** User can flip Designer to crochet, see crochet palette, paint a 4-cell cable that renders as one wide cell, save a custom brioche decrease, and have it appear in the palette. Live on prod.

## Session 2 — Chart-to-text + glossary

**Goal:** Charts produce written instructions automatically; print view auto-generates a stitch glossary.

**PRs:**
1. `chartInstructionService.ts` + 3-mode output in Designer instructions panel (shape only / shape + chart ref / shape + chart text). RS/WS aware, repeat detection, rows-vs-rounds aware.
2. Glossary auto-generation in `PatternPrintView.tsx` — joins used symbols against `chart_symbol_templates`, renders symbol/abbrev/name/RS/WS table.

**Depends on:** Session 1 (RS/WS instruction strings + cell_span)

**Definition of done:** A 16-row cable chart in the Designer renders inline written instructions matching what a knitter would write by hand; print view glossary lists every used stitch with its RS/WS text.

## Session 3 — Publishing-copy export

**Goal:** Designer drafts ship as sellable PDFs.

**PRs:**
1. Pattern metadata form panel (subtitle, designer name, copyright, summary, notes) — stored in draft snapshot JSONB.
2. Two-mode print view: **Knitting copy** (current compact) / **Publishing copy** (cover, gauge, sizing, materials, schematic, charts, instructions, glossary, copyright). Mode picker on `/designer/print?mode=`.

**Depends on:** Session 2 (glossary)

**Definition of done:** Designer draft → publishing PDF that an indie designer would sell on Ravelry without retyping.

## Session 4 — Chart asset library

**Goal:** Charts become reusable assets, not draft-bound. Backend already supports this; we surface it.

**PRs:**
1. `/charts` library page — list/search/duplicate/archive saved charts. Lives in `MainLayout`. Cards show preview thumbnail.
2. Designer wiring: "Save chart as asset" button + "Load saved chart" picker. Chart-export buttons (PNG / PDF / CSV / Markdown / Ravelry JSON) wired to existing `chartExportService`.

**Depends on:** Session 1 (custom stitches reference into `chart_symbol_templates`)

**Definition of done:** Draw a fair-isle motif once, place it on a sweater body, then a hat, then export as PNG to share on Instagram.

## Session 5 — Yarn requirements estimate

**Goal:** Drafts include yardage estimates per color, surfaced in sidebar + print view.

**PR:**
1. New `yarnEstimateService.ts` — stitch count × yarn-per-stitch (gauge-derived, with per-fiber adjustments). Parses chart for color usage. Outputs total + per-color yardage. Designer sidebar widget + Publishing-copy "Materials" section consume the estimate.

**Depends on:** Session 1 (color stitches in chart)

**Definition of done:** A 2-color fair-isle pullover draft shows "MC: 1,180 yds · CC: 380 yds" in the sidebar.

## Session 6a — Cardigan front pieces

**Goal:** Cardigan becomes a first-class shape with proper front pieces.

**PR:**
1. `CardiganFrontSchematic.tsx` (left + right) with button-band, V-neck or round-neck options. `cardigan` itemType in form. Integration with existing Body + Sleeve schematics so a cardigan draft renders 4 pieces in the schematic. Instruction generator extended.

**Depends on:** Session 1

**Definition of done:** "Cardigan" appears in itemType picker; full drop-shoulder cardigan renders schematic + instructions.

## Session 6b — Top-down raglan

**Goal:** Top-down raglan pullover + cardigan as construction options.

**PR:**
1. `RaglanYokeSchematic.tsx` — raglan-line math, neck cast-on, raglan increase distribution. Works for both pullover and cardigan (with 6a's front-piece logic).

**Depends on:** Session 6a

**Definition of done:** Pick "Top-down raglan pullover" → schematic + raglan-rate instructions ("inc 8 sts every other round 24 times…").

## Session 6c — Circular yoke

**Goal:** Circular yoke pullover + cardigan with chart placement on the yoke band.

**PR:**
1. `CircularYokeSchematic.tsx` — yoke depth math, evenly distributed yoke increases (4 standard rates: 0%, 50%, 75%, 90% per Elizabeth Zimmermann). Yoke-band chart placement zone in `ChartOverlay.tsx`.

**Depends on:** Session 6b, Session 4 (chart asset reuse for yoke charts)

**Definition of done:** Circular yoke pullover with a 12-row colorwork chart placed in the yoke band, rendered correctly on the schematic.

## Session 7 — Construction direction toggle

**Goal:** Existing shapes (Body, Sleeve, Hat) get a top-down/bottom-up toggle.

**PR:**
1. Direction toggle on each affected shape. Instruction generators rewritten to handle reversed direction. Schematic flip animation. Sock and shawl stay top-down only.

**Depends on:** Session 6c

**Definition of done:** Sweater body with "Top-down" selected generates "CO neck stitches; pick up shoulder; work armhole shaping in reverse…" correctly.

## Session 8 — Hand vs. machine across all presets

**Goal:** Machine knitters get usable output from every preset, not just Custom Draft.

**PR:**
1. Vocabulary layer over instruction generators — same math, two output modes. Toggle moves from Custom-Draft-only to global.

**Depends on:** Session 7

**Definition of done:** Sock pattern in machine mode reads as a machine-knit pattern.

## Session 9 — Standard size libraries

**Goal:** CYC (Craft Yarn Council) standard sizes as one-click measurement fills.

**PR:**
1. `standardSizes.ts` data file — adults (XS–5XL), children (2T–14), infants. Quick-start picker in Designer that fills the form.

**Depends on:** None (parallel-safe)

**Definition of done:** Pick "Adult M pullover" → all measurements fill to CYC standard.

## Session 10a — Multi-size schema + UI

**Goal:** A single Designer draft holds multiple sizes.

**PR:**
1. Draft snapshot JSONB grows a `sizes: SizeSpec[]` field. Form gains a "Sizes" tab. Each size carries its own measurements + computed stitch counts.

**Depends on:** Session 6c, Session 9

**Definition of done:** Add S/M/L to one draft; schematic shows the largest size with size labels at key points.

## Session 10b — Multi-size print output

**Goal:** Print view supports multi-size patterns.

**PR:**
1. Two presentation modes: **inline notation** ("CO 88 (96, 104) sts") OR **size-table** (separate instruction blocks per size).

**Depends on:** Session 10a

**Definition of done:** Multi-size pullover prints as a knittable graded pattern in either format.

## Session 11 — Crochet garment engine

**Goal:** Crochet gets first-class garment math, not just custom-draft + stitch palette.

**PRs:**
1. Crochet-specific row math (stitch heights vary by stitch type). Turning-chain handling. Joined-round vs. spiral-round option.
2. New crochet-native shapes: granny-square motif, hexagon motif, joined-motif assembly. Crochet pullover/cardigan with crochet-appropriate construction.

**Depends on:** Session 6c, Session 10b

**Definition of done:** A granny-square cardigan draft with proper joining instructions; a top-down crochet pullover with stitch-height-aware row counts.

## Session 12 — Text-to-chart parser

**Goal:** Paste written instructions, get a chart back.

**PR:**
1. `textToChartService.ts` — tokenizes knitter shorthand, maps tokens to symbols, produces grid. UI in `/charts` library: "+ New chart from text".

**Depends on:** Session 2

**Definition of done:** Paste a 4-row cable instruction, get a 4-row chart.

## Session 13 — Designer ↔ calculators integration

**Goal:** Gauge and Gift Size hand off into the Designer.

**PR:**
1. "Open in Designer" button on Gauge calculator (pre-fills gauge inputs) and Gift Size (pre-fills measurements + item type). Return-URL pattern matches the existing Save-to-Project flow.

**Depends on:** Session 1

**Definition of done:** Calculate gauge → click "Design with this gauge" → Designer opens with that gauge filled.

## Session 14 — Designer ↔ stash integration

**Goal:** Stash is alive in the design flow.

**PR:**
1. "Pull yarn from stash" picker in Designer materials section. Estimated yards reserved against stash entries on Save to Project; deducted on project completion.

**Depends on:** Session 5

**Definition of done:** Save Designer draft to project → stash entry shows "1,200 yds reserved."

## Session 15 — Section-vocabulary expansion (Custom Draft)

**Goal:** Add section types based on knitter research.

**PR:**
1. Likely candidates: "short row pair", "buttonhole row", "lace pattern repeat block", "color change". Real list TBD by knitter feedback.

**Depends on:** Knitter feedback from the walkthrough doc

---

## Session kickoff template

When starting a new session, the prompt to fresh Claude should be:

> "Start Session N: <title>. Read `docs/DESIGNER_ROADMAP.md` section for this session. Confirm dependencies are merged and live on prod. Write the migration / PR / tests as scoped. Open PR on `claude/<session-slug>`. After merge, redeploy and smoke-test. Report back."
