# Production npm audit notes

`npm audit --omit=dev --audit-level=high` is the gate. Run from each
package root.

## Backend (`backend/`)

Status: **0 high+ vulnerabilities** (verified 2026-05-03).

Resolution path:
- `bcrypt` bumped 5.1.1 → 6.0.0 to drop the transitive
  `@mapbox/node-pre-gyp` → `tar` chain. bcrypt 6 uses
  `node-addon-api` + `node-gyp-build` instead.
- All other high-severity advisories cleared by `npm audit fix`
  (axios, express, jws, lodash, minimatch, multer, nodemailer,
  path-to-regexp, qs, socket.io-parser).

Remaining moderate/low advisories (do NOT block the gate at
`--audit-level=high`):

| Advisory | Severity | Justification |
|----------|----------|----------------|
| `nodemailer` SMTP injection (GHSA-c7w3, GHSA-vvjj) | moderate | Fix is `nodemailer@8.0.7`, a major bump. We control all `envelope.size` / EHLO inputs (server-side configuration only); user-supplied data never reaches those parameters. Re-evaluate when we expose any user-controlled SMTP envelope field. |
| `uuid` v3/v5/v6 buffer bounds (GHSA-w5hq) | moderate | Fix is `uuid@14.0.0`, a major bump. We only call `v4()` (random) — the bounds check applies to v3/v5/v6 namespace builders we never invoke. |
| `@mozilla/readability` ReDoS (GHSA-3p6v) | low | Fix is a major bump. Readability is invoked only on server-fetched URL bodies inside `pageContextController` and is not directly user-string-driven; ReDoS surface is bounded by SSRF guard and request timeout (30s). Bump scheduled with the next reader-feature touch. |

## Frontend (`frontend/`)

Status: **0 vulnerabilities** at `--omit=dev` (verified 2026-05-03).

Resolution path:
- `npm audit fix` was sufficient; cleared `axios`, `lodash`,
  `react-router*`/`@remix-run/router`, `socket.io-parser`,
  `follow-redirects`, `mdast-util-to-hast`.

Dev-only advisories (vitest / vite / esbuild) are not in the
production gate and are tracked separately.
