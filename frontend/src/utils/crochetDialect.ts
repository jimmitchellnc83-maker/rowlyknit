/**
 * US ↔ UK crochet dialect detection + conversion.
 *
 * The US and UK crochet stitch stacks are offset by one stitch height,
 * which makes copy-paste patterns from one tradition into the other a
 * silent disaster zone. CYC's pattern-reading guidance explicitly flags
 * this:
 *
 *     US sc  = UK dc  (single crochet ≠ double crochet between traditions)
 *     US hdc = UK htr
 *     US dc  = UK tr
 *     US tr  = UK dtr
 *     US dtr = UK trtr
 *
 * Knitting-side terminology shifts too — `gauge` (US) vs `tension` (UK) —
 * and we use that as a corroborating signal.
 *
 * This module gives the pattern-import flow two pure functions:
 *
 *   - `detectCrochetDialect(text)` — heuristic classifier returning
 *     `us` | `uk` | `unknown` with a confidence score and the signals
 *     that drove the decision. Caller decides whether to surface a
 *     warning and an auto-convert offer to the user.
 *
 *   - `convertCrochetDialect(text, from, to)` — rewrite the text by
 *     swapping every recognized US ↔ UK pair. Uses a multi-pass token
 *     replacement so a `dc` → `tr` swap can't be undone by a later
 *     `tr` → `dtr` pass (the canonical pitfall when iterating naively).
 *
 * Neither function does I/O, hits the DOM, or imports React. The
 * `CROCHET_DIALECT_MAP` we extend lives in `techniqueRules.ts`; we
 * keep that as the single source of truth and reach in here.
 *
 * Source: Craft Yarn Council of America's www.YarnStandards.com
 * standards on crochet abbreviations.
 */

export type CrochetDialect = 'us' | 'uk';
export type CrochetDialectGuess = CrochetDialect | 'unknown';

/**
 * Pairs that change between traditions. Symmetric: every entry is a
 * `(us, uk)` rename in both directions. We separately handle the
 * decrease forms (`sc2tog` → `dc2tog`, etc.) and post variants which
 * inherit their parent stitch's rename.
 */
interface DialectPair {
  us: string;
  uk: string;
  /** Why this pair exists, surfaced in the detection report so the user
   *  understands what tipped the heuristic. */
  category: 'stitch' | 'gauge' | 'increase' | 'decrease' | 'post';
}

const DIALECT_PAIRS: DialectPair[] = [
  // Core stitch-stack offset (the load-bearing detection signals).
  { us: 'sc', uk: 'dc', category: 'stitch' },
  { us: 'hdc', uk: 'htr', category: 'stitch' },
  { us: 'dc', uk: 'tr', category: 'stitch' },
  { us: 'tr', uk: 'dtr', category: 'stitch' },
  { us: 'dtr', uk: 'trtr', category: 'stitch' },

  // 2-together decreases.
  { us: 'sc2tog', uk: 'dc2tog', category: 'decrease' },
  { us: 'hdc2tog', uk: 'htr2tog', category: 'decrease' },
  { us: 'dc2tog', uk: 'tr2tog', category: 'decrease' },

  // Post stitches.
  { us: 'FPdc', uk: 'FPtr', category: 'post' },
  { us: 'BPdc', uk: 'BPtr', category: 'post' },
  { us: 'FPsc', uk: 'FPdc', category: 'post' },
  { us: 'BPsc', uk: 'BPdc', category: 'post' },

  // Gauge / tension terminology.
  { us: 'gauge', uk: 'tension', category: 'gauge' },
];

/**
 * Tokens that *only* appear in one dialect (no cross-aliasing) and are
 * therefore strong, unambiguous signals. `sc` and `hdc` are US-only —
 * UK never names a stitch "sc" or "hdc". Conversely `htr` and `trtr`
 * are UK-only since the US stack doesn't use those names.
 */
const STRONG_US_TOKENS = new Set(['sc', 'hdc', 'sc2tog', 'hdc2tog']);
const STRONG_UK_TOKENS = new Set(['htr', 'trtr', 'tension', 'htr2tog']);

/**
 * Tokens that appear in both stacks but mean different things —
 * `dc` and `tr` are notoriously ambiguous. We DON'T weight them in
 * the heuristic because they vote for both sides equally; we surface
 * them in the detection report so the user sees why the dialect
 * matters.
 */
const AMBIGUOUS_TOKENS = new Set(['dc', 'tr', 'dtr']);

const TOKEN_RE = /[A-Za-z0-9]+(?:2tog)?/g;

/**
 * Preserve the case shape of `original` on `replacement`. Handles
 * three patterns the dialect set actually uses:
 *   ALL CAPS → ALL CAPS, Title → Title, lowercase → lowercase.
 * Mixed case (e.g. `FPdc`) passes through unchanged so the canonical
 * entry's casing wins for the post-stitch family.
 */
function matchCase(original: string, replacement: string): string {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original === original.toLowerCase()) return replacement.toLowerCase();
  // Title-case (first character upper, rest lower) covers `Tension`,
  // `Gauge`, `Dc` (rare).
  if (
    original[0] === original[0].toUpperCase() &&
    original.slice(1) === original.slice(1).toLowerCase()
  ) {
    return replacement[0].toUpperCase() + replacement.slice(1).toLowerCase();
  }
  // Mixed (e.g. `FPdc`) — let the canonical entry's casing stand.
  return replacement;
}

export interface DetectionSignal {
  token: string;
  /** How many times the token appears (case-insensitive, distinct
   *  occurrences). */
  count: number;
  /** Which dialect this token is unambiguous evidence for. */
  votes: CrochetDialect;
}

export interface DialectDetectionResult {
  /** The most likely dialect, or `unknown` when neither side has
   *  enough evidence. */
  dialect: CrochetDialectGuess;
  /** Confidence in [0, 1]. 0 = no signals at all; 1 = saturated for
   *  one dialect with nothing voting the other way. */
  confidence: number;
  /** US-side score (sum of strong-US-token counts). */
  usScore: number;
  /** UK-side score. */
  ukScore: number;
  /** Per-token breakdown for the detection-report UI. */
  signals: DetectionSignal[];
  /** Tokens that appeared but couldn't disambiguate (dc, tr) — UI
   *  surfaces these to explain why dialect matters. */
  ambiguous: string[];
}

/**
 * Heuristic dialect classifier. Walks the input text once, tokenizes
 * to alphanumerics, and counts strong + ambiguous tokens. Tie-breaks
 * by ratio: a 2:1 lead is "definitely US/UK"; anything closer is
 * still surfaced but with low confidence.
 */
export function detectCrochetDialect(text: string): DialectDetectionResult {
  const empty: DialectDetectionResult = {
    dialect: 'unknown',
    confidence: 0,
    usScore: 0,
    ukScore: 0,
    signals: [],
    ambiguous: [],
  };
  if (typeof text !== 'string' || !text) return empty;

  const counts = new Map<string, number>();
  const ambiguousSeen = new Set<string>();

  const matches = text.match(TOKEN_RE) ?? [];
  for (const raw of matches) {
    const lower = raw.toLowerCase();
    if (STRONG_US_TOKENS.has(lower) || STRONG_UK_TOKENS.has(lower)) {
      counts.set(lower, (counts.get(lower) ?? 0) + 1);
    } else if (AMBIGUOUS_TOKENS.has(lower)) {
      ambiguousSeen.add(lower);
    }
  }

  let usScore = 0;
  let ukScore = 0;
  const signals: DetectionSignal[] = [];

  for (const [token, count] of counts.entries()) {
    if (STRONG_US_TOKENS.has(token)) {
      usScore += count;
      signals.push({ token, count, votes: 'us' });
    } else if (STRONG_UK_TOKENS.has(token)) {
      ukScore += count;
      signals.push({ token, count, votes: 'uk' });
    }
  }

  // Sort signals: stronger contribution first, then alphabetical
  // within ties for stable display.
  signals.sort((a, b) => b.count - a.count || a.token.localeCompare(b.token));

  if (usScore === 0 && ukScore === 0) {
    return {
      ...empty,
      ambiguous: Array.from(ambiguousSeen).sort(),
    };
  }

  // Confidence = winning_score / total, clamped to [0, 1]. A 5-vs-0
  // count gives 1.0; 5-vs-5 gives 0.5; 6-vs-3 gives 0.667.
  const total = usScore + ukScore;
  const winning = Math.max(usScore, ukScore);
  const confidence = total === 0 ? 0 : winning / total;

  // A 2:1 lead is the threshold for "confident enough to recommend
  // auto-conversion"; anything tighter still picks a dialect but UI
  // should surface as "low confidence — verify before converting".
  let dialect: CrochetDialectGuess;
  if (usScore > ukScore) dialect = 'us';
  else if (ukScore > usScore) dialect = 'uk';
  else dialect = 'unknown';

  return {
    dialect,
    confidence,
    usScore,
    ukScore,
    signals,
    ambiguous: Array.from(ambiguousSeen).sort(),
  };
}

/**
 * Rewrite text by swapping every US ↔ UK token. Uses a two-step
 * approach to avoid the obvious aliasing trap: a naive `dc → tr` pass
 * followed by `tr → dtr` would double-rename the original `dc` → `tr`
 * → `dtr`. We pre-tag every match with a placeholder, then replace
 * placeholders in a second pass.
 *
 * Whole-token matches only (case-insensitive) — we don't want to
 * rewrite "score" because it contains "sc". Punctuation around the
 * token is preserved.
 */
export function convertCrochetDialect(
  text: string,
  from: CrochetDialect,
  to: CrochetDialect,
): string {
  if (typeof text !== 'string' || from === to) return text ?? '';

  // Step 1: tag every from-side token with a placeholder that can't
  // collide with any real word. Map placeholder → replacement so step
  // 2 can swap them out cleanly.
  let placeholderId = 0;
  const replacements = new Map<string, string>();
  const placeholderFor = (replacement: string): string => {
    const key = ` __CDX${placeholderId++}__ `;
    replacements.set(key, replacement);
    return key;
  };

  // Sort pairs by `from`-side length descending so longer tokens
  // (`sc2tog`, `htr`, `dc2tog`) are matched before their substrings.
  const pairs = [...DIALECT_PAIRS].sort(
    (a, b) => b[from].length - a[from].length,
  );

  let working = text;
  for (const pair of pairs) {
    // Whole-token, case-insensitive. Word boundary before + after.
    // We preserve the matched token's case shape — `Tension` → `Gauge`,
    // `SC` → `DC`, `sc` → `dc` — by inspecting the actual match, not
    // the canonical pair entry.
    const fromTok = pair[from];
    const escaped = fromTok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'gi');
    working = working.replace(re, (match) => placeholderFor(matchCase(match, pair[to])));
  }

  // Step 2: swap placeholders for replacements.
  for (const [placeholder, replacement] of replacements.entries()) {
    working = working.split(placeholder).join(replacement);
  }

  return working;
}

/**
 * Convenience: detect, and if `confidence >= threshold` AND the
 * detected dialect differs from the user's `targetDialect`, return
 * the converted text + the detection report. Returns NULL otherwise
 * so the caller can no-op.
 *
 * This is the one-liner pattern-import flows want:
 * `const out = autoConvertCrochet(text, 'us')`.
 */
export function autoConvertCrochet(
  text: string,
  targetDialect: CrochetDialect,
  options: { threshold?: number } = {},
): {
  detection: DialectDetectionResult;
  converted: string;
  changed: boolean;
} {
  const detection = detectCrochetDialect(text);
  const threshold = options.threshold ?? 0.7;

  if (
    detection.dialect === 'unknown' ||
    detection.dialect === targetDialect ||
    detection.confidence < threshold
  ) {
    return { detection, converted: text, changed: false };
  }

  const converted = convertCrochetDialect(text, detection.dialect, targetDialect);
  return {
    detection,
    converted,
    changed: converted !== text,
  };
}
