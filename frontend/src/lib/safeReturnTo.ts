// Validate `?returnTo=` query params before wiring them into <Link to>.
// Calculator pages are public entry points; without this an attacker
// could craft a URL like `/calculators/gauge?returnTo=javascript:alert(1)`
// or `/calculators/gauge?returnTo=https://evil.com` and the Back link
// would honour it. Restrict to internal paths only.
export function safeReturnTo(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Must start with a single `/` (so an internal path like /projects/abc).
  // `//` is protocol-relative — disallow.
  if (raw.length < 2 || raw[0] !== '/' || raw[1] === '/') return null;
  // Belt-and-suspenders against `javascript:` etc. that might sneak past
  // the leading-slash check via URL encoding (decoded by the browser).
  if (/^[\s/]*javascript:/i.test(raw)) return null;
  return raw;
}
