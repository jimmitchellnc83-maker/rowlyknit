/**
 * Tests for shaping math — Sprint 1 Public Tools Conversion.
 */

import { describe, it, expect } from 'vitest';
import { computeShapingPlan } from '../shapingMath';

describe('computeShapingPlan', () => {
  it('clean decrease: 80 → 60 over 40 rows = decrease every 2 rows × 20', () => {
    const out = computeShapingPlan({ startStitches: 80, endStitches: 60, totalRows: 40 });
    expect(out).not.toBeNull();
    expect(out!.shapingType).toBe('decrease');
    expect(out!.totalShapingChanges).toBe(20);
    expect(out!.intervalA).toBe(2);
    expect(out!.countA).toBe(20);
    expect(out!.intervalB).toBeNull();
    expect(out!.instruction).toBe('Decrease every 2 rows 20 times.');
  });

  it('two-interval increase: 60 → 80 over 50 rows = every 3 rows × 10, every 2 rows × 10', () => {
    const out = computeShapingPlan({ startStitches: 60, endStitches: 80, totalRows: 50 });
    expect(out).not.toBeNull();
    expect(out!.shapingType).toBe('increase');
    expect(out!.totalShapingChanges).toBe(20);
    // Math: 50 / 20 = 2.5 → split into intervals of 2 and 3
    // Total rows used = countA*2 + countB*3 = remainder split.
    // 50 = baseInterval=2 * 20 + remainder=10 → 10 of (2+1)=3, 10 of 2.
    // We phrase the longer interval first, so intervalA=3, countA=10, intervalB=2, countB=10.
    expect(out!.intervalA).toBe(3);
    expect(out!.countA).toBe(10);
    expect(out!.intervalB).toBe(2);
    expect(out!.countB).toBe(10);
    expect(out!.instruction).toContain('Increase every 3 rows 10 times');
    expect(out!.instruction).toContain('every 2 rows 10 times');
  });

  it('preserves total row sum across intervals', () => {
    const out = computeShapingPlan({ startStitches: 100, endStitches: 88, totalRows: 73 });
    expect(out).not.toBeNull();
    const total =
      (out!.intervalB === null
        ? out!.intervalA * out!.countA
        : out!.intervalA * out!.countA + (out!.intervalB ?? 0) * (out!.countB ?? 0));
    expect(total).toBe(73);
  });

  it('rejects when start equals end', () => {
    expect(
      computeShapingPlan({ startStitches: 50, endStitches: 50, totalRows: 30 }),
    ).toBeNull();
  });

  it('rejects when changes exceed rows available', () => {
    expect(
      computeShapingPlan({ startStitches: 80, endStitches: 60, totalRows: 5 }),
    ).toBeNull();
  });

  it('rejects nonsensical inputs', () => {
    expect(
      computeShapingPlan({ startStitches: 0, endStitches: 60, totalRows: 30 }),
    ).toBeNull();
    expect(
      computeShapingPlan({ startStitches: 80, endStitches: 60, totalRows: 0 }),
    ).toBeNull();
    expect(
      computeShapingPlan({ startStitches: NaN, endStitches: 60, totalRows: 30 }),
    ).toBeNull();
  });
});
