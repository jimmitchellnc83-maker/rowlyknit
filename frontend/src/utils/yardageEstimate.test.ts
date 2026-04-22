import { describe, it, expect } from 'vitest';
import {
  estimateYardageFromArea,
  formatYardage,
  sumYardageRanges,
} from './yardageEstimate';

const STANDARD_GAUGE = { stitchesPer4in: 20, rowsPer4in: 28 };

describe('estimateYardageFromArea', () => {
  it('scales linearly with area', () => {
    const small = estimateYardageFromArea(100, STANDARD_GAUGE);
    const big = estimateYardageFromArea(1000, STANDARD_GAUGE);
    expect(big.minYds).toBeGreaterThan(small.minYds * 5);
  });

  it('produces a plausible sweater range (~2500 sq in panel pair)', () => {
    // Adult sweater: roughly 40 in chest × 24 in long × 2 (front + back) = 1920 sq in,
    // plus 2 sleeves at ~180 sq in each → ~2280 sq in total.
    const r = estimateYardageFromArea(2280, STANDARD_GAUGE);
    // Standard worsted adult sweater ~ 1000–1500 yards; our range should bracket that.
    expect(r.minYds).toBeGreaterThan(500);
    expect(r.maxYds).toBeLessThan(2500);
  });

  it('produces a plausible scarf range (~8×60 = 480 sq in)', () => {
    const r = estimateYardageFromArea(480, STANDARD_GAUGE);
    // Worsted scarf 8×60 typically wants 250–400 yds. Our estimate should be in that ballpark.
    expect(r.minYds).toBeGreaterThan(150);
    expect(r.maxYds).toBeLessThan(500);
  });

  it('returns max ≥ min and both non-negative', () => {
    const r = estimateYardageFromArea(200, STANDARD_GAUGE);
    expect(r.maxYds).toBeGreaterThanOrEqual(r.minYds);
    expect(r.minYds).toBeGreaterThanOrEqual(0);
  });

  it('handles zero area gracefully (just the overhead)', () => {
    const r = estimateYardageFromArea(0, STANDARD_GAUGE);
    expect(r.minYds).toBeGreaterThan(0); // overhead for tails/swatch
    expect(r.minYds).toBeLessThan(50);
  });
});

describe('sumYardageRanges', () => {
  it('adds mins and maxes', () => {
    const a = { minYds: 100, maxYds: 150 };
    const b = { minYds: 200, maxYds: 250 };
    expect(sumYardageRanges([a, b])).toEqual({ minYds: 300, maxYds: 400 });
  });

  it('handles the empty case', () => {
    expect(sumYardageRanges([])).toEqual({ minYds: 0, maxYds: 0 });
  });
});

describe('formatYardage', () => {
  it('formats a range in yards by default', () => {
    expect(formatYardage({ minYds: 300, maxYds: 400 })).toBe('300–400 yd');
  });

  it('converts to meters when requested', () => {
    const r = formatYardage({ minYds: 100, maxYds: 120 }, 'm');
    // 100 × 0.9144 = 91.44 → 91, 120 × 0.9144 = 109.7 → 110
    expect(r).toBe('91–110 m');
  });
});
