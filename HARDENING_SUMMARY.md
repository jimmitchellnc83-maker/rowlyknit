# Rowly Security & Hardening Summary

**Date:** April 16, 2026
**Branch:** claude/distracted-dubinsky
**PR:** Security hardening — 9 fixes from audit

---

## Changes

### 1. Production environment validation (Fix 1)
**File:** `backend/src/utils/validateEnv.ts`

Promoted `EMAIL_API_KEY` and `REDIS_PASSWORD` from optional (warning-only) to required in production. The app now refuses to start without these variables, preventing insecure production deployments.

### 2. Request timeout configuration (Fix 9)
**Files:** `backend/src/server.ts`, `backend/src/controllers/uploadsController.ts`

Added server-level timeouts: 30s general, 65s keepAlive (above nginx's 60s), 66s headers. Upload handlers (project photos, pattern files, yarn photos) get extended 120s socket timeouts for large files.

### 3. Input validation hardening (Fix 3)
**File:** `backend/src/routes/notes.ts`

Added `isLength()` constraints to all free-text input fields: transcription (50k chars), content (50k), title (500), handwritten notes (10k). Pattern enhancement routes already had full validation. Prevents oversized payloads from reaching the database.

### 4. Audit log index safety net (Fix 6)
**File:** `backend/migrations/20240101000046_audit_log_indexes.ts`

Created migration that ensures composite indexes on `audit_logs` exist (`user_id + created_at`, `entity_type + entity_id`, `created_at`). Uses `pg_indexes` check to avoid duplicate errors — safe to run even if original migration already created them.

### 5. Error boundaries on detail pages (Fix 2)
**File:** `frontend/src/App.tsx`

Wrapped `ProjectDetail`, `PatternDetail`, `YarnStash`, and `YarnDetail` routes in per-route `ErrorBoundary` components. A crash in one detail view now shows a friendly error with reload button instead of a white screen.

### 6. HTML sanitization for Ravelry imports (Fix 5)
**Files:** `backend/src/services/ravelryService.ts`, added `sanitize-html` dependency

Replaced regex-based HTML stripping of Ravelry `notes_html` with `sanitize-html` library. Regex approach could miss edge cases with malformed HTML. No frontend changes needed — no `dangerouslySetInnerHTML` usage found.

### 7. Nginx rate limiting (Fix 7)
**File:** `deployment/nginx/conf.d/rowlyknit.conf`

Applied `auth_limit` zone (5r/m, burst=3) to `/api/auth/` locations on both API and frontend server blocks. Applied `api_limit` zone (10r/s, burst=20) to general `/api/` on the frontend server block. Rate limit zones were already defined in `nginx.conf` but not applied to site-specific locations.

### 8. CSRF middleware upgrade (Fix 8)
**File:** `backend/src/middleware/csrf.ts`, added `csrf-csrf` dependency

Migrated from hand-rolled double-submit cookie CSRF implementation to the `csrf-csrf` library, which is actively maintained and battle-tested. Same exported interface (`conditionalCsrf`, `csrfErrorHandler`, `sendCsrfToken`) — no changes needed in `app.ts`.

### 9. Sentry error monitoring (Fix 4)
**Files:** `backend/src/server.ts`, `backend/src/app.ts`, `frontend/src/main.tsx`

Added `@sentry/node` (backend) and `@sentry/react` (frontend). Both initialize conditionally when `SENTRY_DSN` / `VITE_SENTRY_DSN` env vars are set — no-op otherwise. Sentry Express error handler placed before the global error handler.

---

## Verification

- TypeScript: zero errors (both backend and frontend)
- No new `@ts-nocheck` added
- All existing exports preserved — no breaking interface changes
- New dependencies: `sanitize-html`, `csrf-csrf`, `@sentry/node`, `@sentry/react`

---

## Deploy Checklist

1. Ensure `EMAIL_API_KEY` and `REDIS_PASSWORD` are set in production `.env`
2. Optionally set `SENTRY_DSN` and `VITE_SENTRY_DSN` for error monitoring
3. `git pull && docker-compose up -d --build backend frontend`
4. `docker-compose exec backend npx knex migrate:latest`
5. Verify `https://rowlyknit.com/health` returns 200
