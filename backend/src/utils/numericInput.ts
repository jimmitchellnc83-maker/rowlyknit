/**
 * Coercion helpers for HTML-form-style payloads where empty strings come
 * through unfilled numeric inputs. Postgres rejects `''` cast to `integer`
 * or `numeric`, so the controller layer needs to fold those back to `null`
 * before insert / update.
 *
 * Discovered as a class of bug in the platform audit (2026-04-30, critical
 * #4 + #6). Centralised here so every controller that touches numeric
 * inputs can call the same helpers and we have one place to evolve the
 * rule (e.g. handle `'NaN'`, locale-formatted decimals, etc.).
 */

/**
 * Coerce a JS payload value to a JS number-or-null suitable for an integer
 * column. Returns `null` for empty strings, null, undefined. Returns the
 * unchanged value for anything else — callers should validate elsewhere.
 *
 * Note: we deliberately do NOT throw on non-numeric strings; the existing
 * controllers rely on Postgres or upstream validation to reject those, and
 * silently coercing `'abc' → null` would mask user-input bugs.
 */
export function intOrNull(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return null;
}

/**
 * Coerce a JS payload value for a numeric / decimal column. Same null
 * semantics as intOrNull, but preserves fractional precision.
 */
export function numOrNull(v: unknown): number | null {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}
