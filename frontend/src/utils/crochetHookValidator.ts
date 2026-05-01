/**
 * Steel-hook ambiguity validator.
 *
 * The CYC + Boye/Susan-Bates convention for crochet hooks is **inverted**
 * for steel-lace hooks: the BIGGER the number, the SMALLER the hook.
 * "Steel 14" is 0.6 mm; "Steel 1" is 2.0 mm. Standard (aluminum / wood /
 * plastic) hooks go the conventional direction — bigger number = bigger
 * hook.
 *
 * The two number-spaces overlap dangerously around the small end:
 *
 *   - "7"  alone  →  could be 4.5 mm (standard hook) OR 1.1 mm (Steel 7)
 *   - "5"  alone  →  could be 'F/5' 3.75 mm OR 'Steel 5' 1.5 mm
 *   - "10" alone  →  could be 'J/10' 6.0 mm OR 'Steel 10' 0.85 mm
 *
 * Pattern files often write "size 7 hook" without a family qualifier.
 * If the pattern is a delicate doily it almost certainly means Steel 7;
 * a sweater pattern almost certainly means the standard 4.5 mm hook.
 * The validator exposes ambiguity so the importer / form layer can ask.
 *
 * Source: Craft Yarn Council + Boye / Susan Bates published charts.
 */

import { CROCHET_HOOKS } from '../measurement/reference';
import type { CrochetHookSize } from '../measurement/types';

export type HookFamily = 'steel' | 'standard';

export interface HookCandidate {
  mm: number;
  family: HookFamily;
  /** US label as published (`'7'`, `'F/5'`, `'Steel 7'`). */
  usLabel: string | null;
}

export type HookValidationStatus = 'unique' | 'ambiguous' | 'unknown';

export interface HookValidation {
  status: HookValidationStatus;
  /** Candidates that match the input. Length 1 for `unique`,
   *  2+ for `ambiguous`, 0 for `unknown`. */
  candidates: HookCandidate[];
  /** Human-readable disambiguation guidance — what the UI should
   *  surface to the user. NULL when status is `unique` (no need to
   *  ask). */
  guidance: string | null;
}

/**
 * Parse the numeric portion out of an input. Accepts:
 *   - bare numbers: `"7"`, `"10"`
 *   - "size N" / "size N hook": `"size 7"`, `"size 7 hook"`
 *   - explicit family: `"Steel 7"`, `"steel-7"`, `"7 steel"`,
 *     `"standard 7"`, `"7 standard"`
 *   - letter-only: `"H"`, `"H/8"` (looks up by letter; not ambiguous
 *     because letters are standard-only)
 */
const FAMILY_RE = /(steel|standard)/i;
const SIZE_RE = /(\d+(?:\.\d+)?)/;
const LETTER_RE = /\b([A-Z])\b/;

/**
 * Look up which family the input names. Returns NULL when neither
 * family qualifier is present.
 */
function detectFamily(input: string): HookFamily | null {
  const m = input.match(FAMILY_RE);
  if (!m) return null;
  return m[1].toLowerCase() as HookFamily;
}

/** Find every hook entry whose published US label equals `target`,
 *  optionally restricted by family. */
function lookupByUS(target: string, family: HookFamily | null): CrochetHookSize[] {
  const lower = target.toLowerCase();
  const matches = CROCHET_HOOKS.filter((h) => {
    if (!h.us) return false;
    const hus = h.us.toLowerCase();
    // Exact match: "h/8" matches "h/8".
    if (hus === lower) return true;
    // Steel match: input "7" should match "steel 7" when family
    // qualifier says steel; but also we want bare "7" to match the
    // standard "7" published as "7" (no slash). Handle both.
    if (h.family === 'steel') {
      const stripped = hus.replace(/^steel\s*/, '');
      if (stripped === lower) return true;
    } else {
      // Standard published as "F/5" should match either "F/5", "F",
      // or "5" depending on what the user typed.
      const parts = hus.split('/');
      if (parts.includes(lower)) return true;
    }
    return false;
  });
  if (family) return matches.filter((m) => m.family === family);
  return matches;
}

const toCandidate = (h: CrochetHookSize): HookCandidate => ({
  mm: h.mm,
  family: h.family as HookFamily,
  usLabel: h.us ?? null,
});

/**
 * Validate a user-entered crochet hook size string. Returns the set
 * of canonical candidates plus disambiguation guidance.
 */
export function validateCrochetHookSize(input: string): HookValidation {
  if (typeof input !== 'string' || !input.trim()) {
    return { status: 'unknown', candidates: [], guidance: null };
  }
  const trimmed = input.trim();
  const family = detectFamily(trimmed);

  // Letter-only lookup (always unique — letters are standard-only).
  const letterMatch = trimmed.match(LETTER_RE);
  if (letterMatch && !SIZE_RE.test(trimmed)) {
    const letter = letterMatch[1].toUpperCase();
    const matches = CROCHET_HOOKS.filter((h) => h.letter === letter);
    if (matches.length === 1) {
      return {
        status: 'unique',
        candidates: matches.map(toCandidate),
        guidance: null,
      };
    }
    return {
      status: matches.length === 0 ? 'unknown' : 'ambiguous',
      candidates: matches.map(toCandidate),
      guidance: matches.length === 0 ? `Letter "${letter}" is not a standard CYC hook designator.` : null,
    };
  }

  // Try exact whole-string match — but only for inputs that contain
  // a letter or "steel" qualifier. A bare digit like "7" must fall
  // through to the ambiguity check (matching us='7' here would mask
  // the Steel 7 collision).
  const hasLetter = /[A-Za-z]/.test(trimmed);
  if (hasLetter) {
    const exactMatches = CROCHET_HOOKS.filter((h) => {
      if (!h.us) return false;
      return h.us.toLowerCase() === trimmed.toLowerCase();
    });
    if (exactMatches.length === 1) {
      return {
        status: 'unique',
        candidates: exactMatches.map(toCandidate),
        guidance: null,
      };
    }
  }

  const sizeMatch = trimmed.match(SIZE_RE);
  if (!sizeMatch) {
    return { status: 'unknown', candidates: [], guidance: `Couldn't parse a numeric size from "${input}".` };
  }
  const sizeStr = sizeMatch[1];

  const matches = lookupByUS(sizeStr, family);

  if (matches.length === 0) {
    return {
      status: 'unknown',
      candidates: [],
      guidance: family
        ? `No ${family} hook is published as "${sizeStr}".`
        : `No CYC-published hook is named "${sizeStr}".`,
    };
  }

  if (matches.length === 1) {
    return {
      status: 'unique',
      candidates: matches.map(toCandidate),
      guidance: null,
    };
  }

  // Multiple candidates — must be a steel-vs-standard collision.
  const families = new Set(matches.map((h) => h.family));
  const guidance = families.has('steel' as any) && families.has('standard' as any)
    ? `"${sizeStr}" is ambiguous: it can mean a standard ${matches.find((h) => h.family === 'standard')?.mm}mm hook or a Steel ${sizeStr} (${matches.find((h) => h.family === 'steel')?.mm}mm) lace hook. Bigger steel numbers = smaller hook (inverted from standard). Specify "Steel ${sizeStr}" or "${sizeStr} mm" to disambiguate.`
    : `"${sizeStr}" matches multiple hook entries. Specify the millimeter (mm) value to disambiguate.`;

  return {
    status: 'ambiguous',
    candidates: matches.map(toCandidate),
    guidance,
  };
}

/**
 * Sanity-check that the published reference data preserves the
 * inverted-steel-numbering invariant. Used by tests to confirm the
 * underlying data hasn't drifted.
 */
export function verifyInvertedSteelNumbering(): {
  valid: boolean;
  violations: Array<{ a: string; b: string }>;
} {
  const steel = CROCHET_HOOKS.filter((h) => h.family === 'steel' && h.us != null);
  const violations: Array<{ a: string; b: string }> = [];
  for (let i = 0; i < steel.length - 1; i++) {
    const a = steel[i];
    const b = steel[i + 1];
    const aNum = parseInt(a.us!.replace(/^Steel\s*/, ''), 10);
    const bNum = parseInt(b.us!.replace(/^Steel\s*/, ''), 10);
    // Inverted: as mm increases (we walk i forward through ascending mm),
    // the number should DECREASE.
    if (a.mm < b.mm && aNum < bNum) {
      violations.push({ a: a.us!, b: b.us! });
    }
  }
  return { valid: violations.length === 0, violations };
}
