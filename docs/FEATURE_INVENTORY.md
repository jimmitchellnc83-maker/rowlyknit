# Rowly feature inventory

Comprehensive user-facing feature list with functional status. Last synced **2026-04-23**.

**Legend:**
- **SOLID** — fully functional + polished, no known gaps.
- **WORKS** — functional, rough edges (ugly UI, missing edge-case handling).
- **PARTIAL** — core flow works; documented gaps remain.
- **STUB** — UI or backend exists, the other half doesn't.
- **FLAGGED** — on the 2026-05-07 pruning-decision list.
- **DEFERRED** — intentionally paused (web-first strategy, post-launch).

---

## 1 · Core project tracking

### Projects
| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Create project | SOLID | Dashboard **+** / Projects list / `c` shortcut | New project in 1–2 fields | `POST /api/projects` — quick-create modal with name + status |
| Project detail | SOLID | `/projects/:id` | Hub for everything attached to a project | Fetches project + counters + panels + sessions + notes; 9 sections nav |
| Sticky section nav | SOLID | ProjectDetail | One-tap jump to any section on the long page | IntersectionObserver highlights active chip; smooth scroll |
| Edit project metadata | SOLID | ProjectDetail → pencil | Name, status, dates, description, tags | `PUT /api/projects/:id` |
| Archive / delete project | SOLID | Project actions | Soft-delete with 5s undo toast | `useUndoableDelete` hook — toast cancels DELETE if undo within window |
| Project photos | SOLID | ProjectDetail → Photos | WIP / finished photos with thumbnails | Multer upload, Sharp-generated thumbnail, stored in uploads volume |
| Feasibility badge | SOLID | Project cards on Projects list | Traffic-light (green/amber/red) stash vs. pattern math | Backend aggregates yarn inventory + pattern yardage, emits summary per project |
| Progress percentage | WORKS | Project card + detail | Numeric 0–100 plus bar | Stored on project; updated manually via edit modal |
| Recipient attachment | WORKS | ProjectDetail → sidebar | Associates project with a recipient (gift tracking) | `gifts` junction table — recipient_id NOT on projects directly |
| Project rating | SOLID | ProjectDetail → Rate card | 1–5 stars + notes, publishable | `project_ratings` table (migration 52). Rollup on pattern "made by N" |

### Counters
| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Counter creation | SOLID | ProjectDetail → Counters | Row / stitch / repeat / custom counters | `CounterForm` with progressive disclosure — essentials visible, rest collapsed |
| Increment / decrement / reset | SOLID | CounterCard on detail or in Knitting Mode | +1 / −1 / reset with haptic feedback | REST endpoints + WebSocket broadcast `counter:updated` to other devices |
| Counter hierarchy | SOLID | ProjectDetail → Counters | Parent counter drives children in linked mode | Tree UI with `parent_counter_id` FK |
| Linked counters (cross-counter trigger) | WORKS | Counter detail → Link | "Every N rows on counter A → trigger counter B" | `counter_links` table; condition-action JSON |
| Counter history scrubber | SOLID | Panel knitting view → History | Jump counter back to any historical value | Existing `counter_history` table + undo endpoint; panels re-derive |
| Auto-reset on target | WORKS | CounterForm | Resets to min when it hits target (repeat tracking) | `auto_reset` boolean on counter |
| Counter magic markers | SOLID | CounterCard | Fires alert when counter hits a configured row | `magic_markers` table with trigger_type (row_range / counter_value / interval / stitch_count / time) |

### Panel Mode (multi-panel pattern tracking)
| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Panel group creation | SOLID | `/projects/:id/panels` | Group N panels under one master counter | `panel_groups` table; can create master counter in same call |
| Panel knitting view | SOLID | `/projects/:id/panels/:groupId` | Live knitting screen — tap / swipe / long-press the master | `panelMath.computeLiveState` derives every panel's row via modulo |
| Panel setup (Path A · paste & parse) | SOLID | Setup → Paste | Paste pattern text → regex cascade → editable preview | Backend `patternParser.ts` with priority-ordered matchers |
| Panel setup (Path B · templates) | SOLID | Setup → Templates | 10 curated panel templates (seed, rib, cables, honeycomb, etc.) | Frontend static data |
| Panel setup (Path C · copy from piece) | SOLID | Setup → Copy | Clone every panel from another group | `POST /panel-groups/:id/copy-panels`, transactional |
| Panel setup (Path D · manual) | SOLID | Setup → Manual | Row-by-row manual entry | CollapsibleSection form |
| Row offset (delayed start) | SOLID | Panel edit | Panel shows "Starts in N rows" until offset reached | computeLiveState returns `{started: false}` until master passes offset |
| Alignment math drawer | SOLID | Panel knitting view | LCM + rows-until-next-alignment display | Pure math on panel repeats |
| Pieces dashboard | SOLID | Panel Hub | Every group + master row + panel chips at a glance | `GET /panel-groups/live` aggregate endpoint |
| Voice control (Panel Mode) | SOLID | Panel knitting view → mic | "next" / "back" / "jump to N" / "read all" / "read cable A" / "where am I" | `matchPanelVoiceIntent` grammar + `usePanelVoiceControl` hook + Web Speech API |
| TTS panel read-out | SOLID | Voice "read all" / "read X" | Speaks master + every panel's current instruction | `speechSynthesis` Web Speech API |
| Offline panel mode | SOLID | Panel knitting view | Cached groups; queued advances when offline | localStorage cache + client-side panelMath + existing IDB sync queue |
| Magic-marker banner in panels | SOLID | Above master counter | Colour-coded band when a marker fires at current row | Reuses `/magic-markers/active?row=&counterId=` |

### Sessions + activity
| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Knitting session timer | SOLID | ProjectDetail → Session | Tracks active knitting time with auto-pause | `knitting_sessions` table, 5-min inactivity auto-pause |
| Session history list | SOLID | SessionHistory component | Timeline of past sessions per project | REST query + render |
| GitHub-style activity heatmap | SOLID | Dashboard / Stats / Project | One-year daily rows-knitted grid | Aggregates session duration per day |
| Milestones | WORKS | ProjectDetail → Pieces | Custom milestones (cast on, finish ribbing, etc.) | `project_milestones` table |
| Pieces tracking | SOLID | ProjectDetail → Pieces | Body / sleeves / other pieces with status | `project_pieces` table (migration 50) |

---

## 2 · Library — Patterns / Yarn / Tools / Recipients

### Patterns
| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Upload pattern (PDF) | SOLID | Patterns list + Project detail | Upload PDF, Multer handles file | Multer → stored + text extracted |
| Drag-and-drop file upload | SOLID | Upload modals | Drop zone + file-size validation | `FileUploadField` component with inline validation + 25MB cap |
| Pattern library search | SOLID | `/patterns` | Search by name / designer / techniques / extracted text | Uses extracted PDF text; backend full-text search |
| Pattern detail view | SOLID | `/patterns/:id` | PDF viewer + notes + complexity | PDF.js-powered |
| PDF viewer | SOLID | Pattern detail | Pan / pinch-zoom / page thumbnails | PDF.js |
| Complexity score | SOLID | Pattern card + detail | 1–5 score from detected techniques + sizes | `patternComplexityService` — regex detection of cables / lace / colourwork / short rows |
| "Made by N knitters" | SOLID | Pattern detail | Rollup of completed-project count | `countMakersForPattern` |
| Pattern quick notes | WORKS | Pattern detail | Plain-text notes | `pattern_annotations`, `pattern_highlights` tables |
| Pattern sections | WORKS | Pattern detail | Section markers within long patterns | `pattern_sections` table |
| Pattern collation (merge) | WORKS | Patterns list → Collate | Combine multiple PDFs into one | pdf-lib merge + page reorder |
| Chart image upload | FLAGGED | Project → chart | Upload chart image, OCR grid | 2-week decision date **2026-05-07** |
| Blog pattern import | FLAGGED | Project → add pattern | Paste URL → scrape metadata | 2-week decision date **2026-05-07** |
| Chart row tracker in Knitting Mode | WORKS | Knitting Mode | Highlights current row as counter advances | `ChartRowTracker` component |
| Pattern ratings | WORKS | Pattern detail | Average rating from project_ratings rollup | Aggregates ratings where is_public=true |

### Yarn
| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Yarn stash list | SOLID | `/yarn` | All yarn with filters / sort / Stash Value | Tailwind card grid + `applyListControls` |
| Add yarn (manual) | SOLID | Stash + quick-create | 14-field form with progressive disclosure (Essentials + Inventory + Fiber + Notes collapsibles) | `CollapsibleSection` component |
| Add yarn (label OCR) | WORKS | Add yarn → Scan label | Photo of label → tesseract → auto-fill fields | `YarnLabelCapture` + tesseract.js |
| Add yarn (barcode) | WORKS | Add yarn → Scan barcode | Point camera at UPC → ZXing → lookup | `YarnLabelCapture` + zxing |
| Yarn detail | SOLID | `/yarn/:id` | Specs, photos, usage across projects | |
| Edit yarn | SOLID | Yarn detail | Edit every field + photos (collapsibles) | |
| Yarn weight labelling | SOLID | Everywhere | DK / Worsted / Sport in knitter vernacular (never CYC codes) | User-visible label layer |
| Low-stock filter / alert | WORKS | Stash + Dashboard | Flag yarn under threshold | `low_stock_alert` + `low_stock_threshold` on yarn |
| Stash Value card | SOLID | Yarn stash top | Monetary value of current stash | Aggregates price_per_skein × remaining |

### Tools
| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Tool inventory list | SOLID | `/tools` | Needles / hooks / accessories by type | |
| Add tool | SOLID | Tools + quick-create | Type + size (mm) + material; name auto-suggests | Quick-create auto-names on blur |
| Canonical mm sizes | SOLID | Everywhere | US / metric normalise to mm internally | Migration 42 |
| Tool taxonomy search | WORKS | Tools autocomplete | Category / subcategory / type hierarchy | Taxonomy tables (migration 40) |
| Needle conflict check | SOLID | ProjectDetail → Tools | Badge if needle is assigned to another active project | Real-time query |
| Needle inventory cross-check | SOLID | Project cards | Feasibility check for needle availability | Joined inventory + active-project scan |

### Recipients
| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Recipients list | SOLID | `/recipients` | Name, relationship, last gift | |
| Add recipient (quick-create) | SOLID | QuickCreate + list | First/last name required; measurements + preferences optional | |
| Measurements storage | WORKS | Recipient detail | Chest / waist / hip / arm / head / foot in JSONB | `recipients.measurements` JSONB |
| Preferences (allergies / colours) | WORKS | Recipient detail | Fiber allergies, disliked colours, notes | `recipients.preferences` JSONB |
| Gift history | WORKS | Recipient detail | Projects linked to this recipient via gifts table | `gifts` table with project_id + date_given + was_liked |
| Gift Size Calculator "Load from recipient" | WORKS | Calculators → Gift Size | Auto-fills chest measurement from recipient | |

---

## 3 · Utilities — Calculators + Designer

### Calculators hub
| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Calculator landing | SOLID | `/calculators` | Tile nav to each calc | |
| Gauge calculator | SOLID | `/calculators/gauge` | Scale stitch/row counts from measured vs. pattern gauge | Pure math in `gaugeMath.ts`; tested |
| Yarn substitution calculator | SOLID | `/calculators/yarn-sub` | Check weight + gauge + fibre + yardage compat between two yarns | `yardageEstimate.ts` + fibre-compat matrix |
| Gift size calculator | SOLID | `/calculators/gift-size` | Body measurement + fit → size in W/M/C/Baby schemes | `giftSizeMath.ts` — tested |
| Feasibility (per-project) | SOLID | Project cards | Traffic-light feasibility badge (not on calc hub) | Backend aggregate |

### Pattern Designer
| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Designer form | WORKS | `/designer` | Parametric garment design with live schematic | Large form + SVG schematic render |
| Body schematic | WORKS | Designer | Drag control points to adjust silhouette | `BodySchematic` SVG |
| Sleeve schematic | WORKS | Designer | Cuff-to-cap sleeve editor | `SleeveSchematic` SVG |
| Stitch palette | WORKS | Designer | Choose base stitch + combinations | Library of stitches |
| Colour palette | WORKS | Designer | Palette selection from stash or custom | Pulls from yarn stash |
| Chart grid editor | WORKS | Designer | Cell-by-cell stitch chart editing | Editable SVG grid |
| Print view | WORKS | `/designer/print` | Printer-friendly layout with everything | Print-specific route |
| Gradient Designer | FLAGGED | Designer → Color Planning | Row-by-row colour gradient designer | **2-week decision 2026-05-07** |

---

## 4 · Onboarding + help

| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Example data seeding | SOLID | Registration (automatic) | New users get 3 projects + 8 yarns + 4 patterns + 6 tools + 1 recipient + Panel Mode showcase | `seedExampleDataForUser` on register; is_example flag on 5 root tables |
| Clear example data | SOLID | Profile → Getting started | Two-step-confirm "Clear N example items" | `DELETE /api/users/me/examples` — cascades |
| Guided tour | SOLID | Auto-fires on first Dashboard visit | 5-step Joyride walkthrough of Quick-create, ?, examples, Profile | react-joyride v2.9 + `tour_completed_at` gate |
| Restart tour | SOLID | Profile → Getting started | Resets tour_completed_at | `PUT /api/users/me/tour` |
| Quick-create (+) | SOLID | Floating button + `c` shortcut on every page | Create project/yarn/pattern/tool in 1–3 fields | `QuickCreate` component with 4 minimal forms |
| Contextual page help (?) | SOLID | Floating ? on every page | Tool-by-tool how-to drawer keyed by route | `PageHelp` + `pageHelpContent.ts` route-registry |
| /help hub page | SOLID | `/help` | FAQ + cross-app reference | Static content |
| Global search (⌘K / Ctrl+K) | SOLID | Keyboard shortcut everywhere | Search projects / patterns / yarn / tools / notes | `GlobalSearch` component |
| Cmd-K first-run tooltip | SOLID | Dashboard | Explains the search shortcut to new users | Fades out after dismiss |
| Knitting Mode | SOLID | ProjectDetail → Start Knitting | Distraction-free full-screen counter + pattern | `KnittingModeContext` — hides sidebar, quick-create, help, nav |
| Dark mode | SOLID | Sidebar theme toggle | Dark / light / system | Tailwind `dark:` + localStorage |

---

## 5 · Integrations

### Ravelry
| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| OAuth connect | SOLID | Profile → Integrations | Links Ravelry account | `/api/ravelry/callback` |
| Disconnect | SOLID | Profile → Integrations | Revokes token | |
| Sync bookmarks | SOLID | `/ravelry/bookmarks/sync` | Import selected bookmarks as patterns | |
| Sync favourites | SOLID | `/ravelry/favorites` | Browse + import favourite patterns | |
| Sync favourite yarns | SOLID | `/ravelry/favorites/yarns/sync` | Import as yarn *reference* entries (not stash-counted) | |
| Sync stash | SOLID | `/ravelry/stash/sync` | Import Ravelry stash to Rowly inventory | Matches by ravelry_stash_id |
| Sync projects | SOLID | `/ravelry/projects/sync` | Import Ravelry projects | |
| Pattern search in-modal | SOLID | ProjectDetail → Add Pattern → Search Ravelry | Search Ravelry patterns + import | |
| Yarn search in-modal | SOLID | AddYarnModal → Search Ravelry | Search Ravelry yarn DB + import | |
| Bidirectional sync | DEFERRED | N/A | Write back to Ravelry | Explicit post-launch per memory |

### OCR / Scan
| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Yarn label OCR | WORKS | Yarn add | Camera photo → tesseract text → fields | tesseract.js client-side |
| Yarn barcode scan | WORKS | Yarn add | Camera → ZXing UPC → product lookup | zxing-js |
| Pattern PDF text extraction | SOLID | Pattern upload | Extracts text for search | pdf-parse on backend |

---

## 6 · Notes + annotations

| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Structured memos | SOLID | ProjectDetail → Notes | Titled text notes with dates | `project_structured_memos` table |
| Audio notes | SOLID | ProjectDetail → Notes / Knitting Mode | Record voice memo, auto-transcribed | `MediaRecorder` API + transcription backend |
| Handwritten notes | FLAGGED | ProjectDetail → Notes | Canvas drawing pad | **2-week decision 2026-05-07** |
| Pattern highlights | WORKS | Pattern detail | Highlight / colour passages in pattern text | `pattern_highlights` table |
| Row marker annotations | WORKS | Pattern detail | Notes tied to specific pattern rows | `RowMarker` component |

---

## 7 · Real-time + offline

| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| WebSocket counter sync | SOLID | All counter mutations | Phone increments → desktop updates immediately | Socket.IO project-room broadcasts on `counter:updated` |
| Panel Mode live WS | SOLID | Panel knitting view | Panels re-derive on remote counter push | Subscribes to `counter:updated` |
| Offline mode (counters) | WORKS | Entire app | Counter writes queue, sync on reconnect | IndexedDB sync-queue |
| Offline mode (Panel Mode) | SOLID | Panel knitting view | Cached group payload + local panelMath + queued advances | localStorage cache |
| Offline mode (notes / photos) | WORKS | Notes + photos | Writes queue for later sync | IndexedDB |
| Sync indicator | WORKS | Top-right on project pages | Dot showing online / syncing / offline | `SyncIndicator` component |
| Conflict resolver | PARTIAL | Automatic on reconnect | Resolves two-device edit conflicts | Last-write-wins + version vectors; rare manual resolution |
| PWA install prompt | WORKS | Mobile browsers | Offers add-to-homescreen | `PWAInstallPrompt` component |

---

## 8 · Auth + profile

| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Register | SOLID | `/register` | Email + password + name; verification link | Now also seeds example data |
| Login | SOLID | `/login` | JWT with HttpOnly cookie + refresh | `bcrypt` password hashing + JWT revocation (Redis deny-list) |
| Logout | SOLID | Profile | Revokes access token jti, clears cookies | `utils/tokenRevocation.ts` |
| Forgot password | SOLID | `/forgot-password` | Email with reset token | |
| Reset password | SOLID | `/reset-password?token=` | Token validation + new password | |
| Verify email | SOLID | `/verify-email?token=` | Marks email_verified_at | |
| Ravelry OAuth callback | SOLID | `/auth/ravelry/callback` | Stores access + refresh tokens | |
| Profile: name / email | SOLID | Profile → Profile Info | Edit name + email | Email change triggers re-verify |
| Profile: password change | SOLID | Profile → Change Password | Current + new password | |
| Profile: units (in / cm) | SOLID | Profile → Units | Measurement preference | Applied app-wide |
| Profile: voice prefs | SOLID | Profile → Voice | TTS toggle, silence timeout, lang | |
| Profile: Ravelry status | SOLID | Profile → Integrations | Connect / disconnect | |
| Profile: getting started | SOLID | Profile → Getting started | Clear examples + restart tour | |
| CSRF protection | SOLID | All mutations | Header-based `__csrf` cookie + `x-csrf-token` header | csrf-csrf |
| Rate limiting | SOLID | `/api/*` | Redis-backed global limiter + strict limiter on /auth | express-rate-limit + connect-redis |
| Input sanitization | SOLID | All requests | Strip dangerous HTML / SQL-like tokens | `utils/inputSanitizer.ts` |
| SSRF guard | SOLID | Any user-supplied URL | Blocks private / link-local IPs before fetch | `utils/ssrfGuard.ts` |

---

## 9 · Stats + dashboard

| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Dashboard summary | SOLID | `/dashboard` | Active projects, stash counts, patterns, recipients, recent sessions | Aggregate stats endpoint |
| Activity heatmap | SOLID | Dashboard + Stats | Annual rows-knitted-per-day grid | Session aggregates |
| Recent projects tiles | SOLID | Dashboard | Click-through to active work | |
| Stats page | SOLID | `/stats` | Full-year heatmap + rows/week + session length | Recharts |
| Low-stock alerts | WORKS | Dashboard | Highlight yarn below threshold | |

---

## 10 · Sharing + export

| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Public chart share | WORKS | Pattern detail → Share | Unique token URL, public view | `shared_charts` table |
| Public pattern share | WORKS | Pattern → Share | Public read-only pattern link | `shared_patterns` table |
| Pattern export (PDF) | WORKS | Pattern detail → Export | Bundled PDF export | `pdfkit` |
| Designer print view | WORKS | `/designer/print` | Printer-ready design | Print-styled route |

---

## 11 · Usage telemetry

| Feature | Status | Where | What it does | How |
|---|---|---|---|---|
| Usage events logging | SOLID | Backend | One event per major user action | `usage_events` table (migration 53) |
| Usage events summary | SOLID | `/api/usage-events/summary` | Rollup of events + unique users | Feeds pruning decisions |
| Pruning-candidate telemetry | SOLID | Client-side | GradientDesigner / HandwrittenNotes / BlogImportModal / ChartImageUpload log events | Decision date 2026-05-07 |

---

## 12 · Pruning candidates (2026-05-07 decision)

These features are live but **under review** for removal after two weeks of usage data. Decision based on `uniqueUsers`, not raw event count.

- **GradientDesigner** — `/designer` → Color Planning → Gradient
- **HandwrittenNotes** — ProjectDetail → Notes → Draw
- **BlogImportModal** — ProjectDetail → Add Pattern → Import from URL
- **ChartImageUpload** — Add Pattern → Scan Chart

---

## 13 · Deferred (post-launch)

- **Native iOS / Android apps** — Per memory `project_phase_web_first.md`
- **Widgets** — Paused until PWA is proven
- **Marketplace** — Explicit post-launch
- **Tiers / subscriptions** — Scoped to v2
- **Wearables** — Apple Watch / Wear OS complications
- **Parametric chart / pattern builder v2** — KnitMachine-Pro-style
- **Bidirectional Ravelry sync** — Read-only today, write-back later
- **Stitch dictionary**, **KALs**, **social**, **courses** — All explicitly paused

---

## Known gaps / hygiene

From `project_true_open_items_2026_04_23.md` — confirmed non-blocking:

1. Upload error shape consistency — `uploadsController.ts` hand-writes `{success: false, message}` responses bypassing `errorHandler`. Architectural, not user-visible.
2. Frontend integration test coverage — ~15 component tests, missing auth E2E, ProjectDetail render, route smoke.
3. Heatmap screenshot / share — `html2canvas`-dependent, deferred. OS screenshot still works.

---

## This session's shipped PRs (2026-04-23)

For traceability:
- **#167–172** — Panel Mode full stack (backend, frontend, voice, paste-parse, templates, pieces dashboard, copy-from-group, history scrubber, magic markers, offline)
- **#173–175** — Contextual page help drawer
- **#176** — Global quick-create (+ button, 4 minimal forms, `c` shortcut)
- **#177** — Progressive disclosure on yarn + counter forms
- **#178** — Undoable deletes across list pages
- **#179** — ProjectDetail section nav
- **#180** — Drag-drop file uploads
- **#181** — Staging environment scaffold (droplet + GH Action + nginx + docs)
- **#182** — Seed example data on registration + clear endpoint
- **#183** — Profile "Getting started" tab
- **#184** — Guided tour (react-joyride)
- **#185–186** — Backfill existing users + seed-schema fixes
