/**
 * Tests for yardage estimator math — Sprint 1 Public Tools Conversion.
 */

import { describe, it, expect } from 'vitest';
import { estimateYardage, sizesFor } from '../yardageMath';

describe('estimateYardage', () => {
  it('returns null for unsupported size on a fixed-size garment', () => {
    expect(
      estimateYardage({
        garment: 'hat',
        yarnWeight: 'worsted',
        size: 'xl',
      }),
    ).toBeNull();
  });

  it('worsted adult-medium sweater is in the 1300–1800 yard range', () => {
    const out = estimateYardage({
      garment: 'sweater_adult',
      yarnWeight: 'worsted',
      size: 'm',
    });
    expect(out).not.toBeNull();
    expect(out!.estimatedYards).toBeGreaterThanOrEqual(1300);
    expect(out!.estimatedYards).toBeLessThanOrEqual(1800);
    // High end > midpoint > low end
    expect(out!.rangeHighYards).toBeGreaterThan(out!.estimatedYards);
    expect(out!.rangeLowYards).toBeLessThan(out!.estimatedYards);
  });

  it('lighter yarn needs more yardage than worsted', () => {
    const worsted = estimateYardage({
      garment: 'sweater_adult',
      yarnWeight: 'worsted',
      size: 'm',
    });
    const fingering = estimateYardage({
      garment: 'sweater_adult',
      yarnWeight: 'fingering',
      size: 'm',
    });
    expect(fingering!.estimatedYards).toBeGreaterThan(worsted!.estimatedYards);
  });

  it('heavier yarn needs less yardage than worsted', () => {
    const worsted = estimateYardage({
      garment: 'sweater_adult',
      yarnWeight: 'worsted',
      size: 'm',
    });
    const bulky = estimateYardage({
      garment: 'sweater_adult',
      yarnWeight: 'bulky',
      size: 'm',
    });
    expect(bulky!.estimatedYards).toBeLessThan(worsted!.estimatedYards);
  });

  it('skein count uses the high-end yardage (buy-on-the-safe-side)', () => {
    const out = estimateYardage({
      garment: 'sweater_adult',
      yarnWeight: 'worsted',
      size: 'm',
      skeinYards: 200,
    });
    expect(out!.skeinsAtCustomYd).toBe(Math.ceil(out!.rangeHighYards / 200));
  });

  it('honors custom skein size for skein count', () => {
    const out = estimateYardage({
      garment: 'sweater_adult',
      yarnWeight: 'worsted',
      size: 'm',
      skeinYards: 400,
    });
    expect(out!.skeinsAtCustomYd).toBe(Math.ceil(out!.rangeHighYards / 400));
    expect(out!.skeinsAtCustomYd).toBeLessThan(out!.skeinsAt200Yd);
  });

  it('one-size garments only support one_size', () => {
    expect(sizesFor('hat')).toEqual(['one_size']);
    expect(sizesFor('socks')).toEqual(['one_size']);
    expect(sizesFor('cowl')).toEqual(['one_size']);
  });

  it('adult sweaters carry the full XS–2XL range', () => {
    expect(sizesFor('sweater_adult')).toEqual(['xs', 's', 'm', 'l', 'xl', 'xxl']);
  });
});
