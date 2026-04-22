import { describe, it, expect } from 'vitest';
import { compareGauge, predictFinishedDimension } from './gaugeMath';

describe('compareGauge', () => {
  const target = { stitches: 20, rows: 28, measurement: 4, unit: 'in' as const };

  it('flags identical gauges as on-gauge', () => {
    const r = compareGauge(target, { ...target });
    expect(r.status).toBe('on-gauge');
    expect(r.stitchPercentDiff).toBe(0);
    expect(r.rowPercentDiff).toBe(0);
    expect(r.needleChange).toBe('stay');
    expect(r.widthMultiplier).toBe(1);
  });

  it('flags 5% diff as still on-gauge (within tolerance band)', () => {
    const r = compareGauge(target, { ...target, stitches: 21, rows: 29.4 });
    expect(r.status).toBe('on-gauge');
  });

  it('flags >5% more stitches as too-tight and suggests size-up', () => {
    const r = compareGauge(target, { ...target, stitches: 22 });
    expect(r.status).toBe('too-tight');
    expect(r.stitchPercentDiff).toBe(10);
    expect(r.needleChange).toBe('size-up');
    expect(r.message).toContain('tighter');
    expect(r.message).toContain('up a needle size');
  });

  it('flags >5% fewer stitches as too-loose and suggests size-down', () => {
    const r = compareGauge(target, { ...target, stitches: 18 });
    expect(r.status).toBe('too-loose');
    expect(r.stitchPercentDiff).toBe(-10);
    expect(r.needleChange).toBe('size-down');
    expect(r.message).toContain('looser');
    expect(r.message).toContain('down a needle size');
  });

  it('flags matching stitches but drifting rows as mixed', () => {
    const r = compareGauge(target, { ...target, rows: 32 });
    expect(r.status).toBe('mixed');
    expect(r.rowPercentDiff).toBeGreaterThan(5);
    expect(r.needleChange).toBe('stay');
    expect(r.message).toMatch(/row gauge/i);
  });

  it('normalizes different measurement windows', () => {
    // Target: 20 sts / 4 in === 10 sts / 2 in
    const actual = { stitches: 10, rows: 14, measurement: 2, unit: 'in' as const };
    const r = compareGauge(target, actual);
    expect(r.status).toBe('on-gauge');
  });

  it('normalizes between inches and cm', () => {
    // Target: 20 sts / 4 in. Actual: 20 sts / 10 cm (which is ~3.94 in)
    const actual = { stitches: 20, rows: 28, measurement: 10, unit: 'cm' as const };
    const r = compareGauge(target, actual);
    // 10 cm = 3.937 in, so actual per-4in stitches = 20 * (4/3.937) ≈ 20.32 → within 5%
    expect(r.status).toBe('on-gauge');
  });

  it('calculates width multiplier that predicts narrower finished piece when tight', () => {
    const r = compareGauge(target, { ...target, stitches: 22 });
    // At 22 sts/4in instead of 20, each stitch is narrower
    // finished width = pattern width × (20 / 22) ≈ 0.909
    expect(r.widthMultiplier).toBeCloseTo(20 / 22, 3);
    expect(r.widthMultiplier).toBeLessThan(1);
  });

  it('calculates width multiplier that predicts wider finished piece when loose', () => {
    const r = compareGauge(target, { ...target, stitches: 18 });
    expect(r.widthMultiplier).toBeCloseTo(20 / 18, 3);
    expect(r.widthMultiplier).toBeGreaterThan(1);
  });

  it('guards against zero measurement without throwing', () => {
    const r = compareGauge(
      { stitches: 20, rows: 28, measurement: 0, unit: 'in' },
      target,
    );
    expect(Number.isFinite(r.stitchPercentDiff)).toBe(true);
    expect(Number.isFinite(r.widthMultiplier)).toBe(true);
  });
});

describe('predictFinishedDimension', () => {
  it('returns dimension × multiplier rounded to 2 decimals', () => {
    expect(predictFinishedDimension(20, 1.1)).toBe(22);
    expect(predictFinishedDimension(20, 0.9091)).toBe(18.18);
  });

  it('returns the pattern dimension when multiplier is 1', () => {
    expect(predictFinishedDimension(42, 1)).toBe(42);
  });
});
