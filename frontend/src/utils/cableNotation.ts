/**
 * Cable notation parser — CYC-aligned.
 *
 * CYC publishes cable abbreviations in two forms knitters see in the wild:
 *
 *   - **Slash form**: `1/1 RC`, `2/2 LC`, `3/3 LPC`. Reads "one over one,
 *     right cross". Each side of the slash is the count moved together;
 *     total stitches = sum.
 *   - **Stitch-count form**: `2-st RC`, `4-st LC`, `6-st LPC`. Reads
 *     "two-stitch right cross". The number is the *total* width of the
 *     cable, assumed symmetric (split half-and-half).
 *
 * Both refer to the same stitches when symmetric — `1/1 RC` ≡ `2-st RC`,
 * `2/2 LC` ≡ `4-st LC`. Asymmetric crosses (`2/1 RC` = three stitches,
 * 2 held in front for the cross) only have a slash form; stitch-count
 * notation can't express them, so we surface that in the parsed result.
 *
 * Variants supported (CYC standard + the common extensions):
 *   - `RC` / `LC`   — right / left cross (all knit)
 *   - `RPC` / `LPC` — purl variants (one side worked in purl)
 *   - `RT` / `LT`   — right / left twist (no cable needle, small cables)
 *
 * Source: Craft Yarn Council of America's www.YarnStandards.com.
 */

export type CableDirection = 'right' | 'left';
export type CableVariant = 'cross' | 'purl-cross' | 'twist';

export interface ParsedCable {
  /** Total stitches involved in the cable cross. */
  totalStitches: number;
  /** Stitches in front (or back, depending on direction) and stitches
   *  worked second. NULL when the input is stitch-count form for an
   *  asymmetric cable that can't be split half-and-half. */
  frontCount: number | null;
  backCount: number | null;
  direction: CableDirection;
  variant: CableVariant;
  /** The original input string, trimmed. */
  raw: string;
  /** Canonical slash-form rendering ("2/2 LC", "1/1 RPC"). For inputs
   *  that came in as stitch-count form with an even total, the slash
   *  form is split symmetrically. For odd totals (3-st, 5-st), this
   *  gives the slash form using the most common asymmetric split — but
   *  the user really should re-author with explicit slash form. */
  canonical: string;
}

const SUFFIX_TO_VARIANT: Record<string, { direction: CableDirection; variant: CableVariant }> = {
  RC: { direction: 'right', variant: 'cross' },
  LC: { direction: 'left', variant: 'cross' },
  RPC: { direction: 'right', variant: 'purl-cross' },
  LPC: { direction: 'left', variant: 'purl-cross' },
  RT: { direction: 'right', variant: 'twist' },
  LT: { direction: 'left', variant: 'twist' },
};

const VALID_SUFFIXES = Object.keys(SUFFIX_TO_VARIANT);

const SLASH_RE = /^(\d+)\s*\/\s*(\d+)\s*([A-Z]+)$/i;
const STITCH_COUNT_RE = /^(\d+)\s*-?\s*st\s*([A-Z]+)$/i;

const normalizeSuffix = (raw: string): string => raw.toUpperCase();

/**
 * Parse a cable notation string into a normalized form. Returns NULL
 * for unrecognized inputs (caller decides whether to fall back to a
 * raw string or surface a "couldn't parse" warning). Throws nothing.
 */
export function parseCable(input: string): ParsedCable | null {
  if (typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const slash = trimmed.match(SLASH_RE);
  if (slash) {
    const front = parseInt(slash[1], 10);
    const back = parseInt(slash[2], 10);
    const suffix = normalizeSuffix(slash[3]);
    if (!VALID_SUFFIXES.includes(suffix)) return null;
    if (front <= 0 || back <= 0) return null;
    const meta = SUFFIX_TO_VARIANT[suffix];
    return {
      totalStitches: front + back,
      frontCount: front,
      backCount: back,
      direction: meta.direction,
      variant: meta.variant,
      raw: trimmed,
      canonical: `${front}/${back} ${suffix}`,
    };
  }

  const stitchCount = trimmed.match(STITCH_COUNT_RE);
  if (stitchCount) {
    const total = parseInt(stitchCount[1], 10);
    const suffix = normalizeSuffix(stitchCount[2]);
    if (!VALID_SUFFIXES.includes(suffix)) return null;
    if (total <= 0) return null;
    const meta = SUFFIX_TO_VARIANT[suffix];
    if (total % 2 === 0) {
      const half = total / 2;
      return {
        totalStitches: total,
        frontCount: half,
        backCount: half,
        direction: meta.direction,
        variant: meta.variant,
        raw: trimmed,
        canonical: `${half}/${half} ${suffix}`,
      };
    }
    // Odd-total stitch-count notation can't be split symmetrically;
    // surface that to the caller via NULL counts. The canonical falls
    // back to stitch-count form.
    return {
      totalStitches: total,
      frontCount: null,
      backCount: null,
      direction: meta.direction,
      variant: meta.variant,
      raw: trimmed,
      canonical: `${total}-st ${suffix}`,
    };
  }

  return null;
}

/**
 * Return TRUE when the string looks like cable notation in either form.
 * Cheaper than running the full parser when you just need a yes/no
 * (e.g. a chart-text scanner that wants to flag candidates for parsing).
 */
export function isCableNotation(input: string): boolean {
  if (typeof input !== 'string') return false;
  const trimmed = input.trim();
  return SLASH_RE.test(trimmed) || STITCH_COUNT_RE.test(trimmed);
}

/**
 * Render a parsed cable as a human-readable working instruction.
 * Example: parseCable("2/2 LC") → "Slip 2 sts to cn, hold to front, k2, k2 from cn".
 *
 * Asymmetric crosses produce instructions that quote both sides
 * explicitly. Twists ("RT" / "LT") use the no-cable-needle wording.
 *
 * Returns NULL when the parsed result has unknown counts (asymmetric
 * stitch-count form). Caller should fall back to the raw input.
 */
export function cableInstruction(parsed: ParsedCable): string | null {
  if (parsed.frontCount === null || parsed.backCount === null) return null;
  const front = parsed.frontCount;
  const back = parsed.backCount;
  const dir = parsed.direction;
  const stitchKind = parsed.variant === 'purl-cross' ? 'p' : 'k';

  if (parsed.variant === 'twist') {
    if (dir === 'right') {
      return `k2tog leaving on left needle, k first st again, slip both off (RT)`;
    }
    return `k second st through back loop, then k first st, slip both off (LT)`;
  }

  // Cross / purl-cross share the cable-needle pattern. Direction
  // determines whether held stitches go to front (right cross) or
  // back (left cross).
  const hold = dir === 'right' ? 'back' : 'front';
  const firstHeld = `k${front}`;
  const secondFromCn = parsed.variant === 'purl-cross' ? `p${back}` : `k${back}`;

  return `Slip ${front} sts to cn, hold to ${hold}, ${stitchKind === 'p' ? `p${front}` : firstHeld}, ${secondFromCn} from cn`;
}
