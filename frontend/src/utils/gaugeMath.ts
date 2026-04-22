/**
 * Pure gauge math for the standalone Gauge Calculator.
 *
 * A knitter's "gauge" is stitches × rows over a standard measurement (usually
 * 4 in / 10 cm). If the knitter's swatch gauge differs from the pattern's
 * target, the finished piece will come out wrong — tighter fabric means
 * smaller dimensions, looser fabric means larger.
 *
 * This utility normalizes both gauges to stitches/rows per 4 inches, computes
 * the percent drift per axis, and returns a simple knitter-friendly verdict +
 * a recommended needle-size change. The math intentionally stays simple: a
 * 5% band is within normal swatch variation and considered on-gauge; anything
 * larger gets a "go up" or "go down" recommendation.
 *
 * Kept client-side because this is a stateless calculation — no auth, no DB,
 * works offline in the PWA.
 */

export type GaugeUnit = 'in' | 'cm';

export interface GaugeInput {
  stitches: number;
  rows: number;
  measurement: number;
  unit: GaugeUnit;
}

export type GaugeStatus = 'on-gauge' | 'too-tight' | 'too-loose' | 'mixed';

export type NeedleChange = 'stay' | 'size-up' | 'size-down';

export interface GaugeComparison {
  stitchPercentDiff: number;
  rowPercentDiff: number;
  status: GaugeStatus;
  message: string;
  widthMultiplier: number;
  heightMultiplier: number;
  needleChange: NeedleChange;
  // Stitch/row counts normalized to 4 inches, useful for display.
  targetPer4in: { stitches: number; rows: number };
  actualPer4in: { stitches: number; rows: number };
}

const IN_PER_CM = 1 / 2.54;
const ON_GAUGE_TOLERANCE_PERCENT = 5;

function measurementInInches(measurement: number, unit: GaugeUnit): number {
  return unit === 'cm' ? measurement * IN_PER_CM : measurement;
}

function normalizePer4in(g: GaugeInput): { stitches: number; rows: number } {
  const inches = measurementInInches(g.measurement, g.unit);
  if (inches <= 0) {
    return { stitches: 0, rows: 0 };
  }
  return {
    stitches: (g.stitches / inches) * 4,
    rows: (g.rows / inches) * 4,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Compare a swatch (actual) to a pattern target. Both inputs may use
 * different units or measurements — they're normalized to stitches/rows
 * per 4 inches before comparison.
 *
 * Positive `stitchPercentDiff` means the actual fabric has MORE stitches per
 * inch than the target → tighter fabric → finished piece would be narrower.
 */
export function compareGauge(target: GaugeInput, actual: GaugeInput): GaugeComparison {
  const t = normalizePer4in(target);
  const a = normalizePer4in(actual);

  const stitchPercentDiff = t.stitches > 0 ? ((a.stitches - t.stitches) / t.stitches) * 100 : 0;
  const rowPercentDiff = t.rows > 0 ? ((a.rows - t.rows) / t.rows) * 100 : 0;

  const stitchWithinTolerance = Math.abs(stitchPercentDiff) <= ON_GAUGE_TOLERANCE_PERCENT;
  const rowWithinTolerance = Math.abs(rowPercentDiff) <= ON_GAUGE_TOLERANCE_PERCENT;

  let status: GaugeStatus;
  if (stitchWithinTolerance && rowWithinTolerance) {
    status = 'on-gauge';
  } else if (!stitchWithinTolerance && stitchPercentDiff > 0) {
    status = 'too-tight';
  } else if (!stitchWithinTolerance && stitchPercentDiff < 0) {
    status = 'too-loose';
  } else {
    // stitch gauge matches but row gauge drifts — in knitting this is usually
    // acceptable because length can be adjusted by knitting more or fewer
    // rows without refactoring the pattern.
    status = 'mixed';
  }

  // When knitting with the actual gauge to the pattern's stitch count, the
  // finished width = pattern width × (target stitches per in / actual stitches per in).
  const widthMultiplier = a.stitches > 0 ? t.stitches / a.stitches : 1;
  const heightMultiplier = a.rows > 0 ? t.rows / a.rows : 1;

  const needleChange: NeedleChange =
    status === 'too-tight' ? 'size-up' : status === 'too-loose' ? 'size-down' : 'stay';

  const message = buildMessage(status, stitchPercentDiff, rowPercentDiff);

  return {
    stitchPercentDiff: Math.round(stitchPercentDiff),
    rowPercentDiff: Math.round(rowPercentDiff),
    status,
    message,
    widthMultiplier,
    heightMultiplier,
    needleChange,
    targetPer4in: { stitches: round1(t.stitches), rows: round1(t.rows) },
    actualPer4in: { stitches: round1(a.stitches), rows: round1(a.rows) },
  };
}

function buildMessage(status: GaugeStatus, stitchDiff: number, rowDiff: number): string {
  switch (status) {
    case 'on-gauge':
      return 'Your gauge matches — you\u2019re ready to cast on.';
    case 'too-tight':
      return `Your swatch is ${Math.abs(Math.round(stitchDiff))}% tighter than the pattern. Go up a needle size and re-swatch.`;
    case 'too-loose':
      return `Your swatch is ${Math.abs(Math.round(stitchDiff))}% looser than the pattern. Go down a needle size and re-swatch.`;
    case 'mixed':
      return `Stitch gauge matches, but row gauge is ${rowDiff > 0 ? 'tighter' : 'looser'} by ${Math.abs(Math.round(rowDiff))}%. Usually fine — you can knit more or fewer rows to reach the target length.`;
  }
}

/**
 * Predict the finished dimension given a pattern dimension and the gauge
 * comparison. Used to show "pattern says 20 in, yours would be 20.5 in."
 */
export function predictFinishedDimension(
  patternDimension: number,
  multiplier: number,
): number {
  return Math.round(patternDimension * multiplier * 100) / 100;
}
