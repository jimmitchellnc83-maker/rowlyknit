/**
 * PR #384/#385 follow-up — finding #3.
 *
 * The transactional email templates interpolate `firstName` (set at
 * register, user-controlled) into HTML via `${name}`. Pre-fix that
 * was a raw concatenation, so a name like
 *
 *   <script>alert(1)</script>
 *   "><img src=x onerror=alert(1)>
 *
 * would render in the recipient's mail client. Most modern mail
 * clients sandbox / strip script tags, but image-tag XSS, attribute
 * breakouts, and rendered HTML formatting are all still vectors —
 * and the pattern is bad hygiene regardless. Fix is a shared
 * `escapeHtml` helper applied at every interpolation site.
 *
 * This file pins the helper itself; emailService.test.ts pins that
 * the templates actually call it.
 */

import { escapeHtml } from '../escapeHtml';

describe('escapeHtml — OWASP basic-five entity replacement', () => {
  it('replaces & first so subsequent inserts are not double-escaped', () => {
    // Order matters: &amp; → &amp;amp; if we replaced & after < etc.
    expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
    // Round-trip: the output is itself idempotent under entity decode,
    // never `&amp;amp;`.
    expect(escapeHtml('& <')).toBe('&amp; &lt;');
  });

  it('replaces angle brackets so script tags cannot break out of body context', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
  });

  it('replaces double-quote so attribute context cannot be broken out of', () => {
    // Critical: name interpolated into <a href="${url}"> or similar.
    // Without quote-escape an attacker could close the attribute and
    // inject onmouseover=... etc.
    expect(escapeHtml('"><img src=x onerror=alert(1)>')).toBe(
      '&quot;&gt;&lt;img src=x onerror=alert(1)&gt;',
    );
    expect(escapeHtml('say "hi"')).toBe('say &quot;hi&quot;');
  });

  it('replaces single-quote with the numeric entity (&apos; is XHTML-only)', () => {
    expect(escapeHtml("O'Brien")).toBe('O&#39;Brien');
    // Some mail clients still strip &apos; — &#39; is the safe choice.
    expect(escapeHtml("'><svg/onload=alert(1)>")).toBe(
      '&#39;&gt;&lt;svg/onload=alert(1)&gt;',
    );
  });

  it('returns empty string for null / undefined (defensive default)', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('coerces numbers and booleans through String() before escaping', () => {
    expect(escapeHtml(0)).toBe('0');
    expect(escapeHtml(14)).toBe('14');
    expect(escapeHtml(true)).toBe('true');
    expect(escapeHtml(false)).toBe('false');
  });

  it('leaves text without special chars unchanged', () => {
    expect(escapeHtml('Alice')).toBe('Alice');
    expect(escapeHtml('Knit Knit Cast Off')).toBe('Knit Knit Cast Off');
  });

  it('does not collapse whitespace or unicode (only the five entities)', () => {
    expect(escapeHtml('  spaced  ')).toBe('  spaced  ');
    expect(escapeHtml('café 🧶')).toBe('café 🧶');
  });

  it('handles strings with all five entities in one input', () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;',
    );
  });
});
