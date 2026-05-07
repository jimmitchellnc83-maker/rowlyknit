/**
 * Single source of truth for AdSense placement policy.
 *
 * Why this is a separate file:
 *   - The PublicAdSlot component reads from it at runtime to enforce the
 *     allowlist (a slot rendered on a non-approved route is a no-op).
 *   - The /admin/business AdSense readiness card serves the same lists
 *     to the founder so the policy is observable.
 *   - Tests pin both halves against this file so a future "let me add an
 *     ad to /dashboard real quick" gets caught at PR review time.
 *
 * Policy (from the founder, 2026-05-06):
 *   - DO NOT show ads on the landing page.
 *   - DO NOT show ads anywhere in the logged-in app.
 *   - DO NOT show ads on auth, upgrade, billing, account, or checkout pages.
 *   - Ads are allowed only on public content/tool pages listed below.
 *
 * The site script is NOT loaded from `index.html`. It is injected
 * lazily by `useAdSenseScript` when (and only when) a `PublicAdSlot`
 * mounts on a route in `APPROVED_AD_ROUTES` with a real (non-placeholder)
 * slot id. The hook is a no-op on every other route, so `/`, the entire
 * authenticated app, `/admin/*`, and the auth/upgrade/billing surfaces
 * never load `adsbygoogle.js` — only the SLOTS are gated, and the
 * script load itself is route-scoped on top.
 */

export const ADSENSE_PUBLISHER_ID = 'ca-pub-9472587145183950';

/**
 * Routes where `PublicAdSlot` is allowed to render. Everything else is a
 * no-op — including the landing page (`/`) and every authenticated app
 * route.
 *
 * Adding a new route here is a deliberate policy change. New blog posts
 * under `/blog/*` will need either an explicit pattern match or to be
 * added one-by-one once the blog ships.
 */
export const APPROVED_AD_ROUTES: readonly string[] = [
  '/calculators',
  '/calculators/gauge',
  '/calculators/size',
  '/calculators/yardage',
  '/calculators/row-repeat',
  '/calculators/shaping',
  '/help/glossary',
  '/help/knit911',
] as const;

/**
 * Routes / surfaces where ads are explicitly disallowed. This is
 * surfaced verbatim on the AdSense readiness card so the policy is
 * visible at a glance — and so a regression that lights up an ad
 * somewhere it shouldn't is immediately obvious next to the allowlist.
 */
export const BLOCKED_AD_SURFACES: readonly string[] = [
  '/ (landing page)',
  '/dashboard and the entire authenticated app',
  '/login, /register, /forgot-password, /reset-password, /verify-email',
  '/upgrade',
  '/account/billing',
  '/p/:slug (public FO share — personal artifact, not a content page)',
  '/c/:token (recipient chart viewer)',
  '/calculators/yarn-sub (auth-only)',
  '/admin/* (founder tooling)',
] as const;

/**
 * Pure predicate: does the given pathname match an approved ad route?
 * Exact-match only — query strings and trailing slashes are stripped
 * before comparison.
 */
export function isApprovedAdRoute(pathname: string): boolean {
  if (typeof pathname !== 'string' || pathname.length === 0) return false;
  // Drop query / hash so `/calculators/gauge?units=metric` still matches.
  const stripped = pathname.split('?')[0].split('#')[0];
  // Drop trailing slash unless the path is exactly '/'.
  const normalised = stripped !== '/' && stripped.endsWith('/') ? stripped.slice(0, -1) : stripped;
  return (APPROVED_AD_ROUTES as readonly string[]).includes(normalised);
}
