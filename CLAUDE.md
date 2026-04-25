# Rowly (rowlyknit)

Hand-knitting workspace: row-by-row project tracking, yarn stash, pattern library, parametric garment designer. Frontend = Vite + React + React Router + React Query + Zustand. Backend = Express + TypeScript + Knex/Postgres + Redis + JWT (Bearer or session-cookie+CSRF). Deploy = Docker Compose on a droplet, Nginx in front, PM2 for the backend on the prod box.

Layout:
- `frontend/` — Vite SPA, source in `frontend/src`
- `backend/` — Express API, migrations in `backend/migrations`, source in `backend/src`
- `deployment/` — nginx, ssl, systemd, scripts
- `.github/workflows/deploy-staging.yml` — auto-deploys the `staging` branch (SSH pull + docker rebuild + `npm run migrate`)

## Conventions

- **Working dirs differ** between frontend and backend; `cd` explicitly before running `npx tsc`, `npm test`, etc.
- **Branch naming** for Claude sessions: `claude/<short-topic>`. Don't push to other branches without explicit instruction.
- **Migrations** use the `20240101000NNN_*.ts` filename pattern; bump the trailing index. Always write a working `down`. Run via `npm run migrate` in `backend/` (which builds first via `migrate:reconcile`). Before adding one, `git log backend/migrations/` to confirm the next index hasn't already been claimed by an unmerged branch.
- **API responses** look like `{ success: boolean, data?: ..., message?: string }`. Errors are thrown via `NotFoundError` / `ValidationError` from `utils/errorHandler` and the `asyncHandler` wrapper.
- **Auth routes** mount under `/api/*` and require the `authenticate` middleware. **Public routes** mount under `/shared/*` (rate-limited via `publicSharedLimiter`, 60/min/IP). Static uploads at `/uploads`.
- **CSRF**: enforced on non-GET/HEAD/OPTIONS unless the request has a `Bearer` token. Frontend axios auto-attaches `x-csrf-token` from `/api/csrf-token`.
- **Frontend env vars** are typed in `frontend/src/vite-env.d.ts` — add new `VITE_*` keys there. `VITE_API_URL` defaults to empty so axios falls back to `window.location.origin`; never default it to a real subdomain (PR #198).
- **Tests**: backend Jest with mocked `db` module (see `services/__tests__/projectSharingService.test.ts` for the pattern). Frontend Vitest. `auth.test.ts` requires a live DB and is expected to fail outside CI.
- **Lint baseline** has ~620 pre-existing warnings (mostly `any`); only block on new errors.

## Analytics

Plausible script loads only when `VITE_PLAUSIBLE_DOMAIN` is set. Use `trackEvent(name, props?)` from `frontend/src/lib/analytics.ts`. Established event names — keep these stable, they're tied to dashboards:
- `Signup` — post-register
- `Project Created` — props: `{ type }`
- `Calculator Used` — props: `{ calculator: 'gauge' | 'gift-size' | 'yarn-sub', ... }` (fired once per session per calculator)
- `Project Shared` — props: `{ method: 'toggle' | 'copy_link' | 'pinterest' }`

Server-side `usage_events` table mirrors a subset for founder reporting (see migration #54).

## Public surfaces

- `/calculators`, `/calculators/gauge`, `/calculators/gift-size` — public, indexable, in `sitemap.xml`. Use `useSeo({ title, description, canonicalPath })` for per-page meta. Both calculators have a "Save to project" hand-off (PR #216) that lands in the auth flow with a return URL.
- `/calculators/yarn-sub` — auth-only (ranks the user's stash). `robots.txt` disallows it.
- `/p/:slug` — public FO share page. `noindex,follow` (personal artifact, not landing-page content). Slug format: `<kebab-name>-<4-char-suffix>` from `projectSharingService.generateUniqueSlug`. Slug is stable across publish/unpublish cycles.
- Rate limit on `/shared/*` is `PUBLIC_SHARED_RATE_LIMIT_MAX` (default 60/min).

## Layouts

- `MainLayout` — auth-required, sidebar+nav.
- `PublicLayout` — auth-aware header (Sign in/up vs. Open Dashboard). Use for indexable public pages.
- `AuthLayout` — login/register/etc.

## Naming

User-facing labels matter. Renames that have shipped — don't revert in copy:
- "Panel Mode" → **"Guided Pieces"** (PR #215). Internal table/component names still say `panel*`; only the UI label changed.

## Followups identified but not built

- Server-side meta-tag rendering for `/p/:slug` so Facebook's non-JS scraper picks up og cards (Twitter and Pinterest already run JS).
- Long-form SEO content per calculator (current copy is intentionally minimal).
- Founder-facing analytics dashboard (combines `usage_events` table + Plausible API).
- JSON-LD structured data on calculator pages (`HowTo` / `WebApplication`) for richer SERPs.
- Async `seedExampleData` so `POST /api/auth/register` returns 201 inside nginx timeout (currently the user IS created but the client sees a 502).
- Certbot deploy-hook to auto-copy renewed certs into `deployment/ssl/` and reload nginx.

## Time-sensitive state

Lives in Claude memory files, not here. Check `MEMORY.md` for current sprint state, deploy status, and feature audit findings — those go stale faster than this file should be edited.
