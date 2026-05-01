/**
 * Craft-aware stitch counting — CYC's "How to Read a Pattern" rules
 * codified for the pattern engine.
 *
 * Knit and crochet count stitches differently in two specific cases that
 * trip up readers (and pattern parsers):
 *
 * 1. **Slip-knot.** In **knit** patterns, the slip-knot becomes the
 *    first cast-on stitch — `CO 30` means 30 stitches *including* the
 *    slip-knot. In **crochet**, the slip-knot is invisible to the
 *    stitch count — `ch 30` means 30 chains, with the slip-knot sitting
 *    silently below.
 *
 * 2. **Turning chain (crochet only).** At the start of a new crochet
 *    row, the knitter chains a few stitches to bring the work up to
 *    the height of the next row's stitch. Whether that turning chain
 *    *also* counts as the first stitch of the row depends on the
 *    height:
 *      - sc + ch-1 → does NOT count
 *      - hdc + ch-2 → variable; we default to "does not count"
 *        (the more common modern convention; some vintage patterns flip)
 *      - dc + ch-3 → DOES count (replaces the first dc)
 *      - tr + ch-4 → DOES count
 *      - dtr + ch-5 → DOES count
 *
 * This module exports pure functions that consumers (pattern import,
 * Designer cast-on math, instruction validators) call to get the right
 * answer without re-deriving the rule each time.
 *
 * Source: Craft Yarn Council of America's www.YarnStandards.com
 * "How to Read a Pattern" + standard crochet abbreviations.
 */

export type Craft = 'knit' | 'crochet';

/**
 * Canonical crochet stitch heights that have an associated turning-chain
 * count. Other stitches (special textures like puff, popcorn, picot)
 * inherit the dc rule by convention.
 */
export type CrochetBaseStitch = 'sc' | 'hdc' | 'dc' | 'tr' | 'dtr';

export interface TurningChainRule {
  baseStitch: CrochetBaseStitch;
  /** Number of chains the turning chain has. */
  chainCount: number;
  /** Whether the turning chain replaces (i.e. counts as) the first
   *  stitch of the new row. */
  countsAsStitch: boolean;
  /** Plain-language note for in-app help / glossary surfaces. */
  note: string;
}

/**
 * The canonical CYC turning-chain rules. Indexed by base stitch so
 * lookups are O(1).
 */
export const TURNING_CHAIN_RULES: Record<CrochetBaseStitch, TurningChainRule> = {
  sc: {
    baseStitch: 'sc',
    chainCount: 1,
    countsAsStitch: false,
    note: 'Single crochet rows turn with ch-1 — the chain is just a bridge, the first stitch is worked into the same stitch.',
  },
  hdc: {
    baseStitch: 'hdc',
    chainCount: 2,
    countsAsStitch: false,
    note: 'Half-double-crochet rows turn with ch-2; CYC convention treats the ch-2 as a turn rather than a stitch (modern-pattern default).',
  },
  dc: {
    baseStitch: 'dc',
    chainCount: 3,
    countsAsStitch: true,
    note: 'Double-crochet rows turn with ch-3 and the ch-3 is the first dc — work the next dc into the *second* stitch of the prior row.',
  },
  tr: {
    baseStitch: 'tr',
    chainCount: 4,
    countsAsStitch: true,
    note: 'Treble rows turn with ch-4; the chain is the first tr.',
  },
  dtr: {
    baseStitch: 'dtr',
    chainCount: 5,
    countsAsStitch: true,
    note: 'Double-treble rows turn with ch-5; the chain is the first dtr.',
  },
};

/**
 * Look up the turning-chain rule for a given crochet base stitch.
 * Returns NULL when the input is not one of the recognized base stitches
 * (caller can fall back to the dc rule, since most "tall" stitches
 * follow it).
 */
export function getTurningChainRule(
  baseStitch: string,
): TurningChainRule | null {
  if (typeof baseStitch !== 'string') return null;
  const key = baseStitch.toLowerCase().trim();
  if (key in TURNING_CHAIN_RULES) {
    return TURNING_CHAIN_RULES[key as CrochetBaseStitch];
  }
  return null;
}

/**
 * Whether the slip-knot counts as a stitch for a given craft.
 *
 * Knit: yes — the slip-knot is the first cast-on stitch.
 * Crochet: no — the slip-knot sits silently and the first chain (or
 *          first stitch) is what shows up in the count.
 */
export function slipKnotCountsAsStitch(craft: Craft): boolean {
  return craft === 'knit';
}

/**
 * Compute the *displayed* stitch count for a crochet row given the
 * count of stitches actually worked plus the turning-chain rule. When
 * the turning chain counts as a stitch, the displayed count is
 * `worked + 1` (the chain replaces one of the working stitches).
 *
 * This is the inverse of "how many stitches do I work on this row" —
 * use it when validating pattern numbers or generating instructions.
 *
 * @example
 *   // A 20-stitch row of dc starts with ch-3 and works 19 dc.
 *   adjustedRowCount(19, getTurningChainRule('dc')!) // → 20
 */
export function adjustedRowCount(
  workedStitches: number,
  rule: TurningChainRule,
): number {
  if (workedStitches < 0) return 0;
  return workedStitches + (rule.countsAsStitch ? 1 : 0);
}

/**
 * Inverse of `adjustedRowCount` — given a target stitch count for the
 * row, return the number of stitches the knitter actually works (after
 * the turning chain).
 *
 * @example
 *   workedFromTotal(20, getTurningChainRule('dc')!) // → 19 (ch-3 + 19 dc = 20)
 *   workedFromTotal(20, getTurningChainRule('sc')!) // → 20 (ch-1 + 20 sc = 20)
 */
export function workedFromTotal(
  totalStitches: number,
  rule: TurningChainRule,
): number {
  if (totalStitches < 0) return 0;
  return Math.max(0, totalStitches - (rule.countsAsStitch ? 1 : 0));
}

/**
 * Bag of all the rules for a given craft, suitable for surfacing in
 * help / glossary content. Stable shape so future fields (yarn
 * substitution rules, gauge rules) can land here.
 */
export interface CraftCountingRules {
  craft: Craft;
  slipKnotCountsAsStitch: boolean;
  /** Crochet only — empty for knit. */
  turningChainRules: TurningChainRule[];
}

export function getCraftCountingRules(craft: Craft): CraftCountingRules {
  return {
    craft,
    slipKnotCountsAsStitch: slipKnotCountsAsStitch(craft),
    turningChainRules:
      craft === 'crochet' ? Object.values(TURNING_CHAIN_RULES) : [],
  };
}
