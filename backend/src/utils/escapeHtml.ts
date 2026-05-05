/**
 * Minimal HTML escaper for user-controlled strings interpolated into
 * server-rendered HTML (transactional email templates, og meta tags,
 * any other place where untrusted text needs to be safe inside a
 * `<tag>${value}</tag>` template literal).
 *
 * Why a hand-rolled helper instead of a library:
 *   - The five-replace pattern is the OWASP-recommended baseline and
 *     fits in ~20 lines with zero deps.
 *   - Template-literal HTML rendering only ever needs the body+attr
 *     baseline; we don't have a use case here for full DOMPurify.
 *
 * Covers the OWASP basic five:
 *   &  → &amp;   (must be first so subsequent inserts aren't double-escaped)
 *   <  → &lt;
 *   >  → &gt;
 *   "  → &quot;
 *   '  → &#39;   (numeric entity — &apos; is XHTML-only)
 *
 * Usage:
 *   const html = `<p>Hi ${escapeHtml(user.name)},</p>`;
 *   const attr = `<a href="${escapeHtml(url)}">link</a>`;
 *
 * Pass `null` / `undefined` and you get an empty string — safer for
 * email templates where a missing field shouldn't blow up the render.
 */
export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
