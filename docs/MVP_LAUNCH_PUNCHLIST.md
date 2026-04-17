# MVP Launch Readiness Punch List

Generated 2026-04-17 from four parallel audits (build/test, security, API contracts, frontend UX). GTM mode — **every item is must-have** before launch. Phases are sequencing, not scope reduction.

Secrets were rotated on the production droplet on 2026-04-16 (confirmed by user). Post-MVP roadmap: user tiers + wearables support.

---

## Phase 1 — Security & history hygiene (do first)

- [ ] **Purge leaked secrets from git history.** Commit `c5a8668` added real prod creds to `PRODUCTION_SECRETS.env` / `.env.production`; `5d15bba` overwrote with placeholders but originals recoverable via `git show c5a8668:PRODUCTION_SECRETS.env`. Exposed: `DB_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`, `SESSION_SECRET`. Rotation already done on droplet. Run `git filter-repo --invert-paths --path PRODUCTION_SECRETS.env --path .env.production`, force-push, notify all clones. Best-practice: use `git filter-repo` (not BFG) and follow GitHub's guide on removing sensitive data.
- [ ] **JWT revocation on logout / password-reset.** `backend/src/utils/jwt.ts:61` + `backend/src/middleware/auth.ts:42`. Add `jti` claim at sign, store deny-list in Redis with TTL matching token expiry, check in `authenticate`. Also consult `sessions.is_revoked`.
- [ ] **Source maps hidden in prod.** `frontend/vite.config.ts:180` — set `sourcemap: 'hidden'`; upload to Sentry via plugin for symbolication.

## Phase 2 — Build integrity (flying blind without this)

- [ ] **ESLint config broken.** `frontend/eslint.config.cjs:2-5` and `backend/eslint.config.cjs:2-5` misuse `FlatCompat`. Pick one approach — either pure flat config or delete flat config and keep `.eslintrc.json`. Update `package.json` scripts (remove `--ext`).
- [ ] **Backend tests don't run.** Two bugs: `backend/jest.config.ts` uses invalid `setupFilesAfterSetup` (typo for `setupFilesAfterEach`); `backend/knexfile.ts` has no `test` env so `knex(undefined)` crashes. Add test env to knexfile, fix jest config.
- [ ] **Frontend has zero tests.** Vitest + RTL installed, unused. Add minimum: auth flow, ProjectDetail render, GlobalSearch interaction, route smoke tests.
- [ ] **Remove 42 `console.log`s from src/.** Worst offenders: `main.tsx:86-88,115`, `CounterCard.tsx` (9), `AudioNotes.tsx` (6), `syncManager.tsx` (6), `WebSocketContext.tsx` (4), `axios.ts` (3). Keep `console.error`.

## Phase 3 — Backend correctness

- [ ] **Login-CSRF protection.** `backend/src/middleware/csrf.ts:69-74` exempts `/auth/login` but login sets cookies. Add strict Origin/Referer check for login + refresh.
- [ ] **Axios XSRF cookie name mismatch.** `frontend/src/lib/axios.ts:23` (`_csrf`) vs `backend/src/middleware/csrf.ts:14` (`__csrf`). Align.
- [ ] **Whitelist `sortBy`/`sortOrder`.** `backend/src/controllers/sessionsController.ts:12,31` passes unvalidated to `.orderBy()`.
- [ ] **Soft-delete cascade / cleanup.** `projectsController.deleteProject:267-299` sets `deleted_at` but child endpoints (sessions, counters, notes, charts, magic-markers) don't filter by it. Fix: either add `.whereNotExists(soft-deleted parent)` to child queries OR hard-cascade on delete. Also restore yarn-stash deductions.
- [ ] **Upload error shape + info leak.** `backend/src/controllers/uploadsController.ts:178-185, 369-374` hand-writes `{ success:false, message, error: error.message }` bypassing `errorHandler`. Refactor to `asyncHandler` + throw typed errors.
- [ ] **Project-photo file leak on delete.** `uploadsController.ts:266` uses `path.join(photo.filename)` missing `'uploads/projects'` prefix; original webp never unlinks.
- [ ] **Migration drift reconciliation.** Prod `knex_migrations` has rows 39–46 for files not in repo (documented in HARDENING_SUMMARY AAR lines 104-107). Write reconciliation migrations so next deploy doesn't re-corrupt.
- [ ] **Frontend Dockerfile pin deps.** `frontend/Dockerfile:16` does `rm -f package-lock.json && npm install`. Remove the rm, use `npm ci`.
- [ ] **Consolidate deploy path.** Delete pm2/ssh scripts — `deploy.sh`, `deploy-with-password.exp`, root-level `DEPLOY_*.sh`. Production uses `docker-compose.yml` + `deployment/` + `scripts/deploy-production.sh`.

## Phase 4 — Frontend UX & a11y

- [ ] **Dark mode on all list pages.** Zero `dark:` classes on Dashboard, Projects, Patterns, YarnStash, Recipients, Tools. Cards/modals/inputs/empty states will render unreadable when toggled. Copy Stats.tsx as reference — it's fully themed.
- [ ] **Real 404 page.** `frontend/src/pages/NotFound.tsx` is literally `<h1>NotFound</h1>`. Make it match app style with back-to-dashboard link.
- [ ] **Error states on list pages.** None handle react-query `isError`. On failure: show message + retry button calling `refetch()`.
- [ ] **Skeleton loaders on list pages.** Replace plain "Loading..." on Projects, Patterns, YarnStash, Recipients, Tools, YarnDetail, Dashboard with `LoadingSkeleton`/`LoadingCard` (already exist in `components/LoadingSpinner.tsx`).
- [ ] **Modal focus traps & ARIA.** ~20 modals lack `role="dialog"` / `aria-modal="true"` / focus trap. Tab escapes to content behind. Model after `GlobalSearch.tsx`.
- [ ] **Remove native `alert()` / `confirm()`.** `PhotoGallery.tsx:124`, `ProjectDetail.tsx:203,362`, `PatternDetail.tsx:175`, `FileUpload.tsx:25-32`, `YarnPhotoUpload.tsx:19-28`, `PatternFileUpload.tsx:67-76`. Replace with `ConfirmModal` or toast.
- [ ] **PWA manifest.** `frontend/public/manifest.json` has `icons: []`. VitePWA emits `manifest.webmanifest` — remove the stub, wire `index.html` to use VitePWA's output, add real icons.
- [ ] **GlobalSearch wrong field names.** `components/GlobalSearch.tsx:101-102,111` — `y.color_name` doesn't exist (it's `color`); `r.name` doesn't exist (it's `first_name`/`last_name`). Results show blank.
- [ ] **Submit buttons disabled during request.** Projects, YarnStash, Recipients, Tools create/edit forms allow double-submit.
- [ ] **Persist Knitting Mode.** `ProjectDetail.tsx:53` — save per-project-id to localStorage; restore on mount.

## Phase 5 — Cleanup & pre-tier work

- [ ] **Missing endpoints for future cross-links.** `GET /api/yarn/:id/projects` and `GET /api/recipients/:id/projects` — needed to surface reverse links on YarnDetail and Recipients.
- [ ] **Delete root clutter.** `AUDIT_FINDINGS.md`, `AUDIT_SUMMARY.txt`, `CLAUDE_ACTION_ITEMS.md`, `CLAUDE_DEPLOYMENT_STEPS.md`, `CLAUDE_HANDOFF_PROMPT.md`, `CLAUDE_MERGE_HANDOFF.md`, `CLAUDE_POST_PUSH_ACTIONS.md`, `DEPLOY_CACHE_FIX_NOW.sh`, `DEPLOY_NOW.sh`, `DEPLOY_NOW_COMMANDS.sh`, `DEPLOY_TO_PRODUCTION_NOW.sh`, `FIX_CONFIDENCE_ASSESSMENT.md`, `MAIN_BRANCH_REPORT.md`, `MERGE_RECOVERY_PLAN.md`, `MERGE_VALIDATION_CHECKLIST.md`, `NEXT_STEPS_PLAN.md`, `fix-and-rebuild.sh`, `rebuild-clean.sh`, `restart-nginx.sh`. Keep `README.md`, `HARDENING_SUMMARY.md`, `FEATURE_VALIDATION.md` if still accurate.
- [ ] **Dual eslint configs.** Both `.eslintrc.json` and `eslint.config.cjs` in frontend and backend. Pick one.
- [ ] **Orphan components.** Delete `frontend/src/components/RowCounter.tsx`, `frontend/src/components/YarnPhotoUpload.tsx`, `frontend/src/test-render.tsx`.
- [ ] **Stop tracking `dist/`.** Both frontend and backend have compiled `dist/` in git. Move to `.gitignore`, remove from history (small blast radius — just dist/).
- [ ] **Duplicate pattern-bookmark routes.** `backend/src/routes/patternBookmarks.ts` mostly dead; keep only `PATCH bookmarks/reorder`, move to `pattern-enhancements.ts`.
- [ ] **PUT body validators.** Add express-validator chains on 11 PUT routes currently relying on controller whitelists (projects, patterns, yarn, tools, recipients, sessions, milestones, magic-markers, counters, counter-links, notes).
- [ ] **SSRF guard on PDF collation.** `backend/src/controllers/patternsController.ts:459-464` — allowlist or block non-local URLs.
- [ ] **UUID validators on uploads routes.** `backend/src/routes/uploads.ts` missing `validateUUID('projectId')` etc.
- [ ] **Dashboard low-stock filter.** Currently downloads 100 yarn rows client-side (`useApi.ts:313`). Add `?lowStock=true` on `/api/yarn`.
- [ ] **Vite chunk optimization.** `vendor-react` at 1.26MB; `authStore` and `utils/offline/db.ts` imported both statically and dynamically — de-optimizes chunking.
- [ ] **ProjectDetail.tsx refactor.** 1645 lines — split into subcomponents.
- [ ] **CSP source of truth.** Backend Helmet CSP (`backend/src/app.ts:64`) and nginx CSP (`deployment/nginx/conf.d/rowlyknit.conf:179`) drift. Pick one.
- [ ] **Winston PII redaction.** No `format.redact` in `backend/src/config/logger.ts`; add filter for password/token fields.
- [ ] **Route `console.error` → logger.** Several controllers (e.g. `chartSharingController.ts:48,94,149,201`) bypass Winston and Sentry.

---

## Verified solid (don't re-audit)

Auth scoping by user_id across all controllers; Helmet + HSTS preload; rate limits (auth 5/min, password 3/hr, uploads 20/hr); CORS allowlist (not `*`); env validation refuses boot without secrets; all Knex `.raw()` calls parameterized; Postgres SSL in prod; DB/Redis bound to 127.0.0.1; healthchecks + `restart: unless-stopped`; Sentry wired both sides; Ravelry OAuth state + encrypted token storage; JWT HS256 (no `alg: none`); global search keyboard nav; ErrorBoundary dev/prod modes; Login/Register accessible; nginx HTTPS redirect + TLS 1.2+.

## Reference

- Previous fix: [PR #26 cross-feature navigation](https://github.com/jimmitchellnc83-maker/rowlyknit/pull/26) (merged)
- Prior hardening pass: `HARDENING_SUMMARY.md`
- Existing feature validation: `FEATURE_VALIDATION.md`
