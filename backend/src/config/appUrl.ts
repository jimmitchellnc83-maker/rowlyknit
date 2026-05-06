import logger from './logger';

/**
 * Centralised APP_URL helper. Closes the silent-localhost-fallback P1
 * surfaced in the PR #389 review.
 *
 * `APP_URL` is the canonical base for everything the app emits to a
 * user's email or browser:
 *
 *   - Verification + reset emails (controllers/authController)
 *   - GDPR delete-account confirmation links (services/gdprService)
 *   - Chart + pattern share URLs (services/chartSharingService)
 *   - Lemon Squeezy checkout success redirect (config/billing)
 *
 * Before this helper, each call site read `process.env.APP_URL` with
 * its own ad-hoc fallback (`'http://localhost:3000'`,
 * `'http://localhost:5173'`, `''`). A misconfigured production deploy
 * would silently emit `http://localhost:5173/reset-password?token=...`
 * — broken for the user but no error in the logs.
 *
 * Production rules (NODE_ENV='production'):
 *   - APP_URL must be set.
 *   - It must parse as a `http://` or `https://` URL.
 *   - Otherwise `getAppUrl()` throws and `assertAppUrlValid()` fails the
 *     boot. Better a hard crash than a quiet stream of broken links.
 *
 * Non-production (dev / test / staging that doesn't set NODE_ENV):
 *   - Missing APP_URL → fall back to `http://localhost:5173` (Vite dev
 *     port, what the founder runs locally) with a warning logged once.
 *   - Invalid value → same warn-and-fallback path, so a typo'd dev .env
 *     doesn't break the test suite.
 *
 * Trailing slash always stripped — every caller appends a path that
 * starts with `/`.
 */

const DEV_FALLBACK = 'http://localhost:5173';

let warnedOnce = false;

export function getAppUrl(): string {
  const raw = process.env.APP_URL?.trim();
  if (raw && isValidHttpUrl(raw)) {
    return raw.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    const reason = raw === undefined || raw === '' ? 'is unset' : `(${raw}) is not a valid http(s) URL`;
    throw new Error(
      `APP_URL ${reason}. Production cannot fall back to localhost — ` +
        'email links, checkout redirects, and public share URLs depend on this. ' +
        'Set APP_URL=https://rowlyknit.com (or your prod hostname) before starting the API.',
    );
  }

  if (!warnedOnce) {
    warnedOnce = true;
    logger.warn(
      `APP_URL is not set or invalid — falling back to ${DEV_FALLBACK}. ` +
        'This MUST be set to a real https URL in production.',
      { reason: raw === undefined || raw === '' ? 'unset' : 'invalid' },
    );
  }
  return DEV_FALLBACK;
}

/**
 * Validate APP_URL at process boot. In production this throws if the
 * value is missing or not a valid http(s) URL — `server.ts` lets the
 * exception propagate so the process exits with a non-zero code rather
 * than coming up half-broken.
 *
 * In non-production this is a no-op (the dev fallback is acceptable).
 */
export function assertAppUrlValid(): void {
  if (process.env.NODE_ENV !== 'production') return;
  // Force the production validation path.
  getAppUrl();
}

/** Test-only helper to reset the once-only warn latch between cases. */
export function __resetAppUrlWarnedForTests(): void {
  warnedOnce = false;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
