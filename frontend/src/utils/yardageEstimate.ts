import type { DesignerGauge } from './designerMath';

/**
 * Rough yardage estimate for a finished piece, expressed as a [min, max]
 * range. The real answer always comes from knitting a swatch and doing
 * `(swatch yards used / swatch area) × finished area`, but the ranges here
 * are useful for "do I have enough in this stash" checks before you cast on.
 *
 * Model: for any stocking-stitch-ish fabric, yards consumed scales with
 * the FINISHED AREA (sq in) and the stitch density (stitches per sq in).
 * Denser fabric + finer yarn = more yards per sq in. The empirical
 * constant `yardsPerStitch` here is a middle-of-the-road value; we widen
 * the output range to absorb pattern differences (cables use more, lace
 * uses less, etc.).
 */

/** Yards of yarn consumed by an average stockinette stitch.
 *  Calibrated against published pattern-yardage ranges, using the
 *  corrected (non-double-counted) finished area:
 *    - Worsted adult M sweater: 40" chest × 24" body + 2 × ~11.5" × 18"
 *      sleeves = ~1374 sq in, ~48k sts at 35 sts/sqin. Real published
 *      yardage 800–1300 yds for plain stockinette → ~0.018 yd/stitch.
 *    - Worsted 8" × 60" stockinette scarf: ~480 sq in, ~7.6k sts at
 *      ~16 sts/sqin in bulky weight. Real 200–350 yds → also ~0.018.
 *  Cables use more, lace less; the ±20% range absorbs that. */
const YARDS_PER_STITCH = 0.018;

/** Extra yards to add regardless of area — covers tails for weaving in,
 *  swatching, ribbed cast-on/bind-off, and the usual unit-conversion slop. */
const OVERHEAD_YARDS = 20;

export interface YardageRange {
  /** Low estimate — close-fit, tight knitter, smooth stockinette. */
  minYds: number;
  /** High estimate — loose knitter, cables or textured pattern. */
  maxYds: number;
}

/**
 * Given total finished area in square inches and gauge, return a rough
 * yardage range (whole yards, rounded). Area can be a simple rectangle
 * (width × length), an hourglass (chest × length × 0.9), a triangle
 * (wingspan × depth × 0.5), etc. — caller decides the right approximation
 * for the silhouette.
 */
export function estimateYardageFromArea(
  finishedAreaSqIn: number,
  gauge: DesignerGauge,
): YardageRange {
  const stitchesPerSqIn = (gauge.stitchesPer4in * gauge.rowsPer4in) / 16;
  const totalStitches = Math.max(0, finishedAreaSqIn) * stitchesPerSqIn;
  const base = totalStitches * YARDS_PER_STITCH + OVERHEAD_YARDS;
  // ±20% to absorb pattern / tension variance.
  return {
    minYds: Math.max(0, Math.round(base * 0.85)),
    maxYds: Math.round(base * 1.25),
  };
}

/** Combine several yardage ranges into one (sum the mins, sum the maxes). */
export function sumYardageRanges(ranges: YardageRange[]): YardageRange {
  return ranges.reduce(
    (acc, r) => ({ minYds: acc.minYds + r.minYds, maxYds: acc.maxYds + r.maxYds }),
    { minYds: 0, maxYds: 0 },
  );
}

/** Human-friendly "~400–500 yds" formatter. */
export function formatYardage(r: YardageRange, unit: 'yd' | 'm' = 'yd'): string {
  const mul = unit === 'm' ? 0.9144 : 1;
  const min = Math.round(r.minYds * mul);
  const max = Math.round(r.maxYds * mul);
  return `${min}–${max} ${unit}`;
}
