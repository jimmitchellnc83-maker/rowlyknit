# Rowly Pattern Designer PRD

> **Source.** Authored by the project owner, 2026-04-27, and committed to the repo as the canonical source of truth for the Designer rebuild. This file is the central reference for every future Designer session — read it before opening a PR that touches Designer, schema, or make-mode code. The earlier `docs/DESIGNER_ROADMAP.md` is paused and superseded; see `docs/PATTERN_DESIGNER_GAP_ANALYSIS.md` for what already exists and what needs rebuilding.

## Product vision

Rowly Pattern Designer should become the best real-life design and execution tool for hand knitters and crocheters by unifying pattern design, pattern authoring, and live pattern tracking in one browser-native system.[cite:39][cite:52][cite:63] Current tools split these jobs across separate products: Stitch Fiddle is strong at accessible web charting, KnitCompanion is strong at following patterns during making, and desktop tools such as Stitchmastery and DesignaKnit offer deeper symbol and instruction customization but reflect older, less integrated workflows.[cite:48][cite:52][cite:59][cite:63]

The product should win by treating patterns as living structured systems rather than static PDFs, screenshots, or isolated chart grids.[cite:31][cite:34] This direction also aligns with Rowly's strategy of focusing on premium, underserved execution features rather than becoming a Ravelry clone or a lightweight hobby utility.[cite:1][cite:4]

## Problem statement

Fiber artists often need multiple tools to complete one real project: one tool to design a chart, another to store or write the pattern, and another to track progress while knitting or crocheting.[cite:48][cite:52][cite:63] That fragmentation creates duplicate work, inconsistent pattern logic, and error-prone transitions between chart, text, gauge, and progress tracking.[cite:39][cite:40][cite:52]

The main real-world problems are operational rather than cosmetic:

- Losing place in charts, written instructions, or both during actual making.[cite:39][cite:40][cite:52]
- Managing multiple counters, simultaneous instructions, or parallel repeats across sections and panels.[cite:39][cite:52][cite:61]
- Designing charts that do not translate cleanly into finished dimensions because gauge and measurements were not embedded in the workflow.[cite:63][cite:30]
- Struggling with symbol discoverability, custom stitch behavior, and pattern-specific keys or legends.[cite:48][cite:59][cite:62]
- Maintaining chart instructions and written instructions as separate truths that drift apart over time.[cite:52][cite:55][cite:63]

## Product goal

Build a browser-native pattern system that outperforms the current category by combining better chart creation, better pattern-following, better stitch/symbol customization, and better gauge-driven design intelligence in a single workflow.[cite:48][cite:52][cite:59][cite:63] The tool should support both knitters and crocheters, while adapting behavior by technique rather than forcing all crafts into one generic grid editor.[cite:18][cite:19][cite:24]

## Users

### Primary users

- Independent pattern designers creating original knitting or crochet patterns for sale or distribution.[cite:48][cite:63]
- Serious hobbyists modifying existing patterns, creating charts, and tracking complex projects.[cite:39][cite:40][cite:52]
- Advanced makers working across multiple repeats, motifs, sections, or panels and needing execution support beyond a PDF reader.[cite:36][cite:39]

### Secondary users

- Beginners who need a simplified pathway into chart use, gauge-aware patterning, and row tracking.[cite:40][cite:48]
- Power users migrating from older desktop systems who expect custom stitches, editable keys, and reusable pattern assets.[cite:59][cite:62][cite:63]

## Product principles

### 1. One canonical pattern model

The product should store one structured pattern model and render multiple interfaces from it, instead of storing separate chart, text, and tracker states that can drift apart.[cite:31][cite:34] All product surfaces should read from and write to the same core model.

### 2. Technique-aware behavior

Knitting charts, crochet charts, colorwork grids, filet, tapestry, Tunisian crochet, lace, and cable workflows should not behave identically because their reading direction, symbol logic, and authoring needs differ.[cite:18][cite:19][cite:24] The tool should adapt interaction patterns, validation, and output formatting by craft and technique.[cite:18][cite:19]

### 3. Repeat-first design

Real patterns are commonly built from repeats, motifs, and reusable sections rather than manually authored cell by cell.[cite:18][cite:19][cite:24] Repeat behavior should be a first-class concept throughout creation, editing, export, and live tracking.

### 4. Gauge-first patterning

The system should help users design fabric outcomes, not just visual charts, by embedding gauge, dimensions, and size logic early in the workflow.[cite:30][cite:63] Users should always be able to understand what a design means in physical measurements.

### 5. Design-to-make continuity

A pattern should remain useful during execution, not stop being useful once the chart is drawn or the PDF is exported.[cite:39][cite:52][cite:55] The product should seamlessly move from planning to authoring to live making.

## Jobs to be done

| User job | Current frustration | Rowly outcome |
|---|---|---|
| Create a chart for a real knitting or crochet pattern | Existing tools often separate charting from gauge, notes, and tracking.[cite:48][cite:63] | One environment to chart, size, annotate, and export.[cite:31][cite:34] |
| Follow a complex pattern while crafting | Users rely on counters, highlights, and reminders across multiple apps or paper hacks.[cite:39][cite:40][cite:52] | Synchronized make mode with linked counters and row context.[cite:52][cite:61] |
| Convert pattern logic into reusable assets | Motifs, keys, and custom stitches are often hard to reuse cleanly.[cite:59][cite:62] | Saveable stitch, motif, section, and repeat libraries. |
| Design for finished dimensions | Grid tools do not reliably communicate physical size impact.[cite:63][cite:30] | Gauge-driven stitch and row planning with size outputs. |
| Manage complex simultaneous repeats | Multi-panel or "at the same time" logic is hard to track in existing general tools.[cite:36][cite:39] | Dedicated parallel-repeat and multi-panel tracking. |

## Scope

### In scope

- Knitting and crochet pattern design
- Written instructions plus charts
- Gauge and measurement support
- Symbol libraries and custom stitches
- Pattern legend and key management
- Repeat/motif tools
- Multi-size support
- Live pattern-following and row tracking
- Import/export for common pattern workflows
- Mobile and tablet-friendly make mode

### Out of scope for initial launch

- Full machine knitting integration
- Full social community layer
- Marketplace functionality
- CAD-like garment simulation
- Broad support for unrelated crafts beyond knitting/crochet core

## Core product architecture

### Canonical entities

The system should be built around the following core entities:

- Pattern
- Section
- Row or round
- Stitch or symbol
- Repeat block
- Motif block
- Gauge profile
- Size set
- Materials list
- Legend or key
- Notes and finishing instructions
- Progress state

These entities should support both authored pattern data and in-progress making state so the same pattern can be designed, published, and followed without duplication.[cite:31][cite:34]

### Pattern model requirements

Each pattern should support:

- Craft type: knitting or crochet.[cite:18][cite:19]
- Technique type: standard, lace, cables, colorwork, tapestry, filet, Tunisian, or similar variants.[cite:18][cite:19][cite:24]
- Gauge profile including stitches and rows per unit, swatch context, tool size, and blocked versus unblocked state.[cite:30]
- Multi-size measurement logic.
- Pattern sections and sub-sections.
- Chart layers and written instruction layers.
- Project-specific symbol legend and abbreviations.[cite:18][cite:19][cite:62]
- Repeats, markers, panel relationships, and simultaneous-instruction support.[cite:36][cite:61]
- Live progress state per user or project.

## Main modes

### Design mode

Design mode is the visual construction environment. It should support chart editing, section-based pattern layout, symbol insertion, motif creation, repeat tools, colorwork planning, and custom symbol creation.[cite:48][cite:59][cite:63]

Key requirements:

- Technique-specific chart modes.
- Symbol palette with search, categories, and favorites.
- Repeats as editable structural objects.
- Motif duplication and transformation tools.
- Section-level composition for garments and patterned pieces.
- Color and stitch overlays where relevant.
- Gauge-aware visual feedback on dimensions.

### Author mode

Author mode is where users turn structured pattern logic into usable documentation. It should include written row or round instructions, legends, notes, abbreviations, finishing instructions, materials, measurements, and size tables.[cite:18][cite:19][cite:62]

Key requirements:

- Written instructions linked to sections and rows.
- Legend and key manager.
- Special stitch definitions.
- Materials and tool lists.
- Multi-size notation handling.
- US and UK terminology handling for crochet.[cite:19]
- Export-oriented print layout previews.

### Make mode

Make mode is the execution layer and should become a signature differentiator for Rowly. It should support row highlighting, linked counters, simultaneous instruction management, reminders, chart/text sync, progress tracking, and multi-panel coordination.[cite:39][cite:52][cite:55][cite:61]

Key requirements:

- Active row highlighting across chart and written views.
- Multiple linked counters.
- Section and panel progress tracking.
- Repeat counters and reminders.
- "At the same time" instruction support.
- Mobile-friendly hands-busy interaction design.
- Persistent context for complex projects.

## Feature requirements

### 1. Technique-specific chart engine

The chart engine should adapt behavior by craft and technique instead of using one universal interaction model.[cite:18][cite:19][cite:24] For knitting, directionality and right-side/wrong-side logic matter; for crochet, symbol semantics and construction behavior differ materially.[cite:18][cite:19]

Required chart modes:

- Knitting chart
- Crochet chart
- Colorwork grid
- Filet crochet chart
- Tapestry crochet chart
- Tunisian crochet chart
- Lace/cable-friendly chart mode

### 2. Symbol library and customization

The system should ship with strong default symbol coverage grounded in standard conventions while allowing custom symbols, custom rendering, custom descriptions, and custom keys per pattern.[cite:18][cite:19][cite:59][cite:62] Symbol behavior should support searchability, categorization, and reusability.

Requirements:

- Standard symbol packs for knitting and crochet.[cite:18][cite:19]
- Custom stitch/symbol creation.
- Editable names, abbreviations, descriptions, and rendering.
- User-level saved symbol library.
- Pattern-level symbol overrides.
- Visual legend generation.

### 3. Repeat engine

The repeat engine should underpin both authoring and making. It should represent horizontal, vertical, nested, mirrored, motif-based, and marker-based repeats as structured logic rather than plain text.[cite:18][cite:19][cite:24]

Requirements:

- Horizontal repeats
- Vertical repeats
- Nested repeats
- Mirrored repeats
- Motif repeats
- Between-markers repeats
- Independent panel repeats in one row
- Repeat-aware highlighting in make mode

### 4. Gauge and size engine

The gauge engine should connect chart logic to physical output so users can design with confidence.[cite:30][cite:63] The product should calculate and surface stitch counts, row counts, approximate dimensions, and size impacts.

Requirements:

- Gauge entry in imperial and metric units.[cite:30]
- Blocked/unblocked gauge variants.[cite:30]
- Measurement profiles by size.
- Real-time dimension calculations.
- Warnings when chart scale and intended size diverge.
- Pattern-size variations driven by gauge and measurement rules.

### 5. Chart-to-text relationship layer

The system should synchronize chart logic and written instructions where feasible, while supporting manual overrides for nuanced or stylistic pattern writing.[cite:52][cite:55][cite:63] Users should never feel forced into either chart-only or text-only authoring.

Requirements:

- Auto-generated written summaries from chart structure where possible.
- Text-linked row and repeat references.
- Manual overrides for editorial phrasing.
- Conflict states when chart and text diverge.
- Side-by-side editing with synchronized focus.

### 6. Live tracking and execution tools

This area should incorporate the strongest real-world habits already validated by knitting users: linked counters, reminders, joined chart segments, and easy recovery when attention breaks during crafting.[cite:39][cite:52][cite:55][cite:61]

Requirements:

- Row counters
- Repeat counters
- Linked counters
- Timed or row-based reminders
- Marker-aware navigation
- Panel-aware progress states
- Mistake recovery helpers such as manual rollback or mark-as-complete controls

### 7. Reusable assets and templates

The system should let users save reusable motifs, sections, custom stitches, legends, and templates so the tool compounds value over time.[cite:59][cite:62][cite:34]

Requirements:

- Motif library
- Repeat library
- Section templates
- Garment part templates
- Symbol/stitch presets
- Legend presets
- Materials presets

## Import and export

### Import

Users should be able to start from blank, from a chart, or from an existing pattern workflow. The initial import scope should prioritize usefulness over perfect conversion.

Recommended early import targets:

- PDF-based pattern reference attachment
- Manual row/round import
- Chart image reference import
- Symbol/key-assisted enrichment workflow

### Export

Exports should serve both distribution and making.

Required export targets:

- Chart-only export with legend
- Written instructions export
- Combined pattern export
- Printable/PDF-friendly layout
- Shareable link or read-only pattern view

## UX requirements

### Cross-device behavior

The product should work across desktop, tablet, and mobile, but each mode should optimize for actual usage context. Design and author modes will be desktop-first, while make mode should be tablet and mobile-strong because many crafters use small screens or propped tablets while working.[cite:39][cite:52]

### Complexity management

Advanced power should be layered progressively. The first-use experience should support simple pattern entry, while advanced users can opt into technique rules, custom symbols, multi-size logic, and repeat orchestration over time.[cite:40][cite:48]

### Error prevention

The interface should help prevent mistakes by surfacing directionality, repeat boundaries, conflicting chart/text states, and dimension mismatches before a user exports or begins making.[cite:18][cite:19][cite:63]

## Analytics and learning system

The product should instrument real user behavior to find where current workflows still break down, because the long-term advantage comes from learning faster than older craft tools.[cite:1][cite:4]

Track at minimum:

- Where users switch between chart and text views
- Where users manually correct auto-generated text or repeats
- Which techniques create the most editing friction
- Where users abandon setup
- Which counters or trackers are most used during make mode
- Which symbols require custom overrides most often
- Which export formats are chosen by craft and technique
- Which reminders reduce mistakes or drop-offs

## Success metrics

### Product success

- Users can complete a full design-to-make workflow in one product.[cite:34]
- Complex-pattern users adopt the tracking layer instead of external counters or ad hoc notes.[cite:39][cite:52]
- Designers reuse motifs, repeats, and custom symbols over time.
- Patterns stay synchronized across chart, text, and progress state.

### UX success

- Reduced abandonment in gauge setup and pattern setup.
- Reduced manual repeat management outside the tool.
- Reduced place-loss while following charts or written instructions.
- Higher completion rates for complex projects.

## Differentiation strategy

Rowly should position itself as the only modern web product that combines:

- Better web-native charting accessibility than legacy desktop tools.[cite:48][cite:63]
- Better live execution support than typical charting tools.[cite:39][cite:52]
- Better structured pattern intelligence than simple PDF trackers.[cite:52][cite:55]
- Better repeat and gauge awareness than generic craft grid editors.[cite:24][cite:30][cite:63]

The most defensible wedge is not "more features." It is a tighter integration of the exact jobs users already piece together across Stitch Fiddle, KnitCompanion, Stitchmastery, and DesignaKnit.[cite:48][cite:52][cite:59][cite:63]

## Recommended rollout

### Phase 1: foundation

- Canonical pattern schema
- Technique rules framework
- Core chart editor
- Legend/key manager
- Gauge model
- Basic written rows/rounds
- Basic row tracking

### Phase 2: intelligence

- Repeat engine
- Chart/text synchronization
- Multi-size support
- Custom stitch builder
- Motif and section libraries

### Phase 3: execution advantage

- Full make mode
- Linked counters
- Multi-panel tracking
- Reminder engine
- Mobile/tablet optimization
- Import/export expansion
- Behavioral analytics

## Engineering guidance for Claude

Claude should build the system schema-first, not canvas-first, because the biggest category failure mode is producing a polished chart editor that lacks real pattern semantics, sizing logic, and execution support.[cite:31][cite:35] The correct implementation order is:

1. Canonical data model
2. Technique rules engine
3. Repeat engine
4. Symbol and chart layer
5. Author mode
6. Make mode
7. Import/export and analytics

This sequence keeps the product aligned with real craft logic and protects against building shallow UI before the domain model is mature enough to support durable features.[cite:31][cite:34]
