# Pattern Designer — current state vs. PRD gap analysis

> **Purpose.** A concrete map of what already exists in the repo against what `docs/PATTERN_DESIGNER_PRD.md` requires. Read this before kicking off the rebuild — the goal is to avoid throwing away working code and to identify the smallest first PR that moves the canonical schema forward without breaking existing surfaces.

> **Authored** 2026-04-27 alongside the PRD commit. Refresh whenever a Phase-1 PR lands.

## TL;DR

- The current Designer is **form-first**, not **schema-first**. A `DesignerForm` JSONB blob feeds 8 hardcoded itemType compute functions that produce schematics + step lists. There is no `Pattern` entity that ties chart + text + gauge + sizes + progress together.
- ~30 % of the PRD's Phase 1 surface area already exists in some form (gauge prefs, chart symbols + craft tag, chart asset library, chart-to-text engine, two-mode print view, project-level row tracking).
- The honest first PR for the rebuild is **the canonical pattern schema migration + service layer**, not UI. UI consumers migrate after the schema is in place.

## Canonical entities — exists vs. missing

| PRD entity | Current state | Where it lives today |
|---|---|---|
| **Pattern** | ❌ Missing as a structured entity | A `patterns` table exists for storing pattern *records*, but Designer drafts live as `DesignerFormSnapshot` JSONB inside that table — flat, not relational |
| **Section** | ⚠️ Hardcoded per-itemType | `customDraft` has user-composable `Section[]` (`src/types/customDraft.ts`); the 7 preset itemTypes (sweater body+sleeve, hat, scarf, blanket, shawl, mittens, socks) have fixed sections baked into their compute functions |
| **Row / Round** | ⚠️ Implicit | Row indices live inside `chart.cells` (chart-row only) and inside compute step lists (instruction-row only); not unified, not first-class |
| **Stitch / Symbol** | ✅ Exists | `chart_symbol_templates` table (knit + crochet, abbreviation, RS/WS instruction, cell_span, craft) — Sessions 1–4 of the old roadmap built this |
| **Repeat block** | ❌ Missing | `ChartOverlay` tiles charts implicitly (bottom-left anchored); no horizontal/vertical repeat counts, no nested/mirrored/motif/marker repeats, no panel-independent repeats |
| **Motif block** | ❌ Missing | Charts are flat grids; no motif duplication or transformation |
| **Gauge profile** | ⚠️ Partial | `users.preferences.measurements` holds gauge per user; `DesignerForm` holds `gaugeStitches`/`gaugeRows`/`gaugeMeasurement` per draft. No blocked/unblocked variants, no swatch context, no tool-size-per-section |
| **Size set** | ❌ Missing | Single-size only (no S/M/L grading); `useMeasurementPrefs` profile exists for the active user but doesn't drive size variants |
| **Materials list** | ⚠️ Partial | `yarnEstimatePerColor.ts` produces a per-color yardage range; not yet structured as a "materials" entity tied to the pattern |
| **Legend / key** | ⚠️ Partial | `chart_symbol_templates` is a global symbol library; `useChartSymbols` reads it. No pattern-level overrides, no per-pattern legend |
| **Notes** | ⚠️ Partial | `patternNotes` lives on `DesignerFormSnapshot` as a free-text field; no row/section linkage |
| **Progress state** | ⚠️ Partial — wrong shape | Project-level row tracking exists in `KnittingModeLayout.tsx` and `sessions` table, but it tracks a project's pattern *PDF*, not a structured pattern model |

## Mode-by-mode coverage

### Design mode

| PRD requirement | Current state | Notes |
|---|---|---|
| Technique-specific chart modes | ❌ One mode | `craft` field exists on chart symbols (knit/crochet) but only filters the palette; no filet, tapestry, Tunisian, lace, or cable-specific chart behavior |
| Symbol palette w/ search, categories, favorites | ✅ | `StitchPalette.tsx` regrouped by System / My / Recent / Used (Session 1) |
| Repeats as editable structural objects | ❌ Missing | |
| Motif duplication / transformation | ❌ Missing | |
| Section-level composition | ⚠️ Custom Draft only | `CustomDraftEditor.tsx` lets users stack arbitrary sections; preset itemTypes don't expose sections |
| Color + stitch overlays | ✅ | `ChartGrid.tsx` supports both; `ChartOverlay.tsx` projects chart onto schematic silhouettes |
| Gauge-aware visual feedback | ✅ Partial | Schematics consume gauge; `YardageEstimateWidget.tsx` shows live yardage |

### Author mode

| PRD requirement | Current state | Notes |
|---|---|---|
| Written instructions linked to rows | ⚠️ Partial | `chartInstruction.ts` (Session 2) generates row-by-row text from charts in 3 modes. Manual edit not wired through the canonical model |
| Legend / key manager | ⚠️ Partial | Glossary auto-generates in print view (Session 2 PR #237); no pattern-level legend customization |
| Special stitch definitions | ✅ | `CustomStitchModal.tsx` (Session 1) |
| Materials & tool lists | ⚠️ Yardage only | Print view has a "Materials" yardage block; no full materials/tools entity |
| Multi-size notation | ❌ Missing | |
| US/UK terminology toggle for crochet | ❌ Missing | |
| Print layout previews | ✅ | `PatternPrintView.tsx` two-mode (knitting / publishing copy) — Session 3 |

### Make mode

| PRD requirement | Current state | Notes |
|---|---|---|
| Active row highlighting across chart + written | ⚠️ Project-level only | `KnittingModeLayout.tsx` tracks rows in a project, not a Designer pattern |
| Multiple linked counters | ❌ | |
| Section / panel progress tracking | ⚠️ | Project-level only |
| Repeat counters + reminders | ❌ | |
| "At the same time" instruction support | ❌ | |
| Mobile-friendly interaction | ⚠️ Partial | KnittingModeLayout is touch-friendly but isn't tied to the canonical pattern model |
| Persistent context | ⚠️ | Sessions persist per project, not per pattern |

## What to keep, what to rebuild

### Keep (already structurally close to PRD)

- `chart_symbol_templates` table + service — foundational Symbol entity (extend with technique tags + per-pattern overrides later)
- `charts` table + `/charts` library — foundational Motif/Chart-asset entity (Session 4)
- `users.preferences.measurements` — gauge / unit prefs already canonical via `useMeasurementPrefs`
- `chartInstruction.ts` chart-to-text engine — keep as the bidirectional bridge between chart and written instructions
- `PatternPrintView.tsx` two-mode print — re-target to read from the canonical Pattern, not `DesignerFormSnapshot`
- `yarnEstimatePerColor.ts` + `designerArea.ts` — canonical "Materials" math; rewire to read from Pattern.gauge + Pattern.sections
- `sessions` row-tracking table — extend to track Pattern.section/row, not just project-PDF row index

### Rewrite or wrap (semantic shift required)

- `DesignerForm` / `DesignerFormSnapshot` — collapse into the canonical Pattern entity; the 8 itemType variants become Section *templates*, not branches of a switch
- 8 compute functions (`computeBodyBlock`, `computeHat`, etc.) — keep the math, but invoke them as Section *layouts* off a Pattern, not as itemType-switch branches
- 8 schematic components — keep as renderers, but feed them from canonical Pattern.section computed outputs instead of raw form fields
- `customDraft` — the section-stacking model becomes the *general* case; preset itemTypes are just curated section stacks
- `ChartOverlay` — re-target to render a Pattern.section's chart placement (which becomes structured: an offset, a repeat-mode, a layer index), not a raw bitmap tile
- `KnittingModeLayout.tsx` — re-target to track Pattern row + section + panel state, not project-PDF row

### Throw away (no structural fit)

- The hardcoded `ITEM_TYPE_OPTIONS` enum branching in `PatternDesigner.tsx` — replaced by Section templates picked from a library
- The form-first state shape (`DEFAULT_FORM` + per-itemType field families) — replaced by Pattern → Section entity tree

## Recommended Phase 1 ordering

Per the PRD's engineering guidance: **schema-first, not UI-first**. The first PR is data-model only and ships invisibly behind a feature flag.

### PR 1 — Canonical pattern schema (backend)

- Migration: new `pattern_models` table (or extend `patterns`) holding `craft`, `technique`, `gauge_profile`, `size_set`, `sections[]`, `legend`, `materials`, `progress_state` as JSONB or relational rows
- TypeScript types in `frontend/src/types/pattern.ts` and `backend/src/types/pattern.ts`
- Service layer (`patternService.ts` backend) with CRUD + a one-shot importer that reads existing `DesignerFormSnapshot` JSONB rows and writes equivalent canonical Pattern rows alongside (don't migrate yet — both schemas live side-by-side)
- Tests for the importer covering each itemType
- **Definition of done:** every existing draft has a canonical Pattern shadow row; no UI changes; all existing surfaces still read the old schema

### PR 2 — Technique rules engine

- `frontend/src/utils/techniqueRules.ts` — pure functions that take `(craft, technique, contextType)` and return reading direction, repeat semantics, terminology dialect (US/UK), validation rules
- Wire into chart symbol filtering (replaces the current `craft`-only filter on `chart_symbol_templates`)
- Test matrix per technique × craft

### PR 3 — Repeat engine

- `frontend/src/types/repeat.ts` — `RepeatBlock` discriminated union (horizontal | vertical | nested | mirrored | motif | between-markers | panel)
- `repeatEngine.ts` — given a `Section`, expand repeats to a flat row sequence for both chart rendering and instruction text
- Tests covering each repeat shape + nesting

### PR 4 — Symbol + chart layer (canonical)

- Re-target `ChartOverlay` to read `Section.chartPlacement` (offset + repeat mode + layer)
- Add per-pattern symbol override layer on top of `chart_symbol_templates`
- Migrate the chart asset library (`charts` table) to attach to `Pattern.sections[i].charts[j]` instead of standalone-only

### PR 5 — Author mode (UI behind flag)

- New route `/patterns/:id/author` reading the canonical Pattern
- Side-by-side chart/text editor with sync
- US/UK terminology toggle

### PR 6 — Make mode (UI behind flag)

- New route `/patterns/:id/make` reading canonical Pattern + `progress_state`
- Linked counters, repeat counters, "at the same time" reminders
- Multi-panel tracking
- Mobile-strong layout

### PR 7 — Import/export + analytics

- Pattern import from existing PDF/blog flows (extends existing `BlogImportModal`, `ChartImageUpload`)
- Export targets: chart-only, text-only, combined, shareable link
- `usage_events` schema extension to track the make-mode behaviors listed in the PRD's analytics section

## Cross-cutting concerns

- **Don't break the live Designer.** `PatternDesigner.tsx` has paying users (or will). The new Pattern model lives alongside the form-snapshot model until UI cuts over. Last cleanup PR removes the legacy form path.
- **Migrate progress, don't reset.** Sessions data has user trust attached to it. Any schema change to `sessions` must preserve completed-row counts.
- **Mobile is non-negotiable for make mode.** Don't punt mobile to a "Phase 4 polish PR" — it's central to the differentiation argument vs. KnitCompanion.
- **Analytics from day 1.** The PRD's "track which symbols require custom overrides" etc. is hard to retrofit. Wire `usage_events` writes into Phase 1 surfaces as they ship, not at the end.

## What the old `docs/DESIGNER_ROADMAP.md` becomes

Sessions 1–5 already shipped (chart symbol foundation, chart-to-text + glossary, publishing-copy export, chart asset library, yardage estimate). Their code is the "Keep" column above.

Sessions 6a–15 are paused. Some belong inside the new model (cardigan front pieces, top-down raglan, circular yoke = Section templates; standard size libraries = Size set seed data; multi-size schema = part of Pattern model; designer↔stash = Materials wiring). Others get rewritten or dropped (construction-direction toggle, hand-vs-machine vocabulary become technique-rules variants; text-to-chart parser becomes part of Author mode chart/text sync).

When the rebuild reaches a session that maps to an old-roadmap session, fold the old session's design notes in — don't restart from scratch.
