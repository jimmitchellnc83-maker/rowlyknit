import { describe, it, expect } from 'vitest';
import { finishedAreaSqIn } from './designerArea';
import type { DesignCompute } from './designerSnapshot';

const baseSummary = { itemType: '', itemLabel: '', dimensions: [], castOnStitches: null };

describe('finishedAreaSqIn', () => {
  it('returns null for an empty compute', () => {
    expect(finishedAreaSqIn({})).toBeNull();
    expect(finishedAreaSqIn({ summary: baseSummary })).toBeNull();
  });

  it('sweater: 2 × body panel + 2 × sleeve trapezoid', () => {
    const compute = {
      body: { finishedChest: 40, finishedLength: 24 },
      sleeve: {
        finishedCuff: 8,
        finishedBicep: 14,
        finishedTotalLength: 18,
      },
    } as unknown as DesignCompute;
    // body = 40 × 24 = 960; sleeve = ((8+14)/2) × 18 = 198. Total = 2×960 + 2×198 = 2316.
    expect(finishedAreaSqIn(compute)).toBe(2316);
  });

  it('hat: circumference × height × 0.9', () => {
    const compute = {
      hat: { finishedCircumference: 20, finishedHeight: 8 },
    } as unknown as DesignCompute;
    expect(finishedAreaSqIn(compute)).toBeCloseTo(144, 5);
  });

  it('scarf: width × length', () => {
    const compute = {
      scarf: { finishedWidth: 8, finishedLength: 60 },
    } as unknown as DesignCompute;
    expect(finishedAreaSqIn(compute)).toBe(480);
  });

  it('blanket: width × length', () => {
    const compute = {
      blanket: { finishedWidth: 36, finishedLength: 48 },
    } as unknown as DesignCompute;
    expect(finishedAreaSqIn(compute)).toBe(1728);
  });

  it('shawl: triangle area = wingspan × depth × 0.5', () => {
    const compute = {
      shawl: { finishedWingspan: 60, finishedDepth: 24 },
    } as unknown as DesignCompute;
    expect(finishedAreaSqIn(compute)).toBe(720);
  });

  it('mittens: 2 × (hand × length) + thumb allowance', () => {
    const compute = {
      mittens: {
        finishedHandCircumference: 8,
        finishedLength: 10,
        finishedThumbCircumference: 3,
      },
    } as unknown as DesignCompute;
    // 2 × (8×10 + 3×2.5) = 2 × (80 + 7.5) = 175.
    expect(finishedAreaSqIn(compute)).toBe(175);
  });

  it('socks: 2 × ankle × total length', () => {
    const compute = {
      socks: { finishedAnkleCircumference: 8, finishedTotalLength: 22 },
    } as unknown as DesignCompute;
    expect(finishedAreaSqIn(compute)).toBe(352);
  });

  it('customDraft: starting width × total height × 0.85', () => {
    const compute = {
      customDraft: { startingWidthInches: 20, totalHeightInches: 30 },
    } as unknown as DesignCompute;
    expect(finishedAreaSqIn(compute)).toBe(510);
  });

  it('sweater without sleeve falls through (returns null)', () => {
    const compute = {
      body: { finishedChest: 40, finishedLength: 24 },
    } as unknown as DesignCompute;
    expect(finishedAreaSqIn(compute)).toBeNull();
  });
});
