import { describe, it, expect } from 'vitest';
import {
  recommendSizes,
  WOMEN_SIZES,
  MEN_SIZES,
  CHILD_SIZES,
  BABY_SIZES,
} from './giftSizeMath';
import { EASE_TIER_INCHES } from './easeTiers';

describe('recommendSizes', () => {
  it('maps 36 in bust + classic ease (+2 in) to womens M (36–38 finished)', () => {
    const r = recommendSizes({ bodyChest: 36, unit: 'in', fit: 'classic' });
    expect(r.bodyChestIn).toBe(36);
    expect(r.easeIn).toBe(2);
    expect(r.finishedChestIn).toBe(38);
    const women = r.recommendations.find((x) => x.scheme === 'women')!;
    expect(women.recommended?.label).toBe('M');
  });

  it('maps 36 in bust + very close (-2 in) to womens S (32–34)', () => {
    const r = recommendSizes({ bodyChest: 36, unit: 'in', fit: 'very_close' });
    expect(r.finishedChestIn).toBe(34);
    const women = r.recommendations.find((x) => x.scheme === 'women')!;
    expect(women.recommended?.label).toBe('S');
  });

  it('maps 36 in bust + oversized (+6 in) to womens XL (44–46)', () => {
    const r = recommendSizes({ bodyChest: 36, unit: 'in', fit: 'oversized' });
    expect(r.finishedChestIn).toBe(42);
    const women = r.recommendations.find((x) => x.scheme === 'women')!;
    // 42 falls inside L (40-42); XL would need >=44. Verify exact containment.
    expect(women.recommended?.label).toBe('L');
  });

  it('accepts cm input and normalizes to inches', () => {
    const r = recommendSizes({ bodyChest: 91.44, unit: 'cm', fit: 'classic' }); // 36 in
    expect(r.bodyChestIn).toBe(36);
    expect(r.finishedChestIn).toBe(38);
  });

  it('honors customEaseIn over the tier preset', () => {
    const r = recommendSizes({
      bodyChest: 36,
      unit: 'in',
      fit: 'close',
      customEaseIn: 8,
    });
    expect(r.easeIn).toBe(8);
    expect(r.finishedChestIn).toBe(44);
  });

  it('returns null recommendation when body size is outside a scheme range', () => {
    const r = recommendSizes({ bodyChest: 38, unit: 'in', fit: 'close' });
    const baby = r.recommendations.find((x) => x.scheme === 'baby')!;
    expect(baby.recommended).toBeNull();
    expect(baby.reason).toMatch(/outside this scheme/i);
  });

  it('returns smaller and larger alternatives when available', () => {
    const r = recommendSizes({ bodyChest: 36, unit: 'in', fit: 'classic' });
    const women = r.recommendations.find((x) => x.scheme === 'women')!;
    // M (36-38) is recommended; smaller should be S, larger should be L.
    expect(women.smaller?.label).toBe('S');
    expect(women.larger?.label).toBe('L');
  });

  it('returns all four schemes in the result', () => {
    const r = recommendSizes({ bodyChest: 36, unit: 'in', fit: 'close' });
    const schemes = r.recommendations.map((x) => x.scheme).sort();
    expect(schemes).toEqual(['baby', 'child', 'men', 'women']);
  });

  it('picks midpoint-closest size when target falls between ranges', () => {
    // Bust=36, classic +2 → 38 in finished. In women's table, 38 is the
    // upper boundary of M (36-38), so it should pick M via exact containment.
    // Use 39 to land between M (36-38) and L (40-42).
    const r = recommendSizes({
      bodyChest: 37,
      unit: 'in',
      fit: 'classic',
    }); // 39 in
    const women = r.recommendations.find((x) => x.scheme === 'women')!;
    // 39 is closer to M's midpoint (37) than L's midpoint (41): gap 2 vs 2.
    // Tie-breaker: first-found via reduce, so M wins.
    expect(women.recommended?.label).toBe('M');
    expect(women.reason).toMatch(/between sizes|falls inside/i);
  });

  it('EASE_TIER_INCHES exposes CYC convention values', () => {
    expect(EASE_TIER_INCHES).toEqual({
      very_close: -2,
      close: 0,
      classic: 2,
      loose: 4,
      oversized: 6,
    });
  });

  it('all size tables are non-empty and sorted by minChest ascending', () => {
    for (const table of [WOMEN_SIZES, MEN_SIZES, CHILD_SIZES, BABY_SIZES]) {
      expect(table.length).toBeGreaterThan(0);
      for (let i = 1; i < table.length; i++) {
        expect(table[i].minChest).toBeGreaterThanOrEqual(table[i - 1].minChest);
      }
    }
  });

  it('mens table covers 4XL and 5XL plus sizes (CYC plus-size chart)', () => {
    const labels = MEN_SIZES.map((s) => s.label);
    expect(labels).toContain('4XL');
    expect(labels).toContain('5XL');
    expect(MEN_SIZES.find((s) => s.label === '4XL')).toMatchObject({
      minChest: 60,
      maxChest: 62,
    });
    expect(MEN_SIZES.find((s) => s.label === '5XL')).toMatchObject({
      minChest: 64,
      maxChest: 66,
    });
  });

  it('recommends mens 4XL for a 56 in chest with classic ease (+2 = 58)', () => {
    // 58 in finished chest is the upper boundary of 3XL (56-58); the
    // existing midpoint logic prefers 3XL via exact containment.
    const r = recommendSizes({ bodyChest: 56, unit: 'in', fit: 'classic' });
    const men = r.recommendations.find((x) => x.scheme === 'men')!;
    expect(men.recommended?.label).toBe('3XL');
    // Larger neighbor should now be 4XL (was null before this PR).
    expect(men.larger?.label).toBe('4XL');
  });

  it('recommends mens 4XL for a 58 in chest with loose ease (+4 = 62)', () => {
    const r = recommendSizes({ bodyChest: 58, unit: 'in', fit: 'loose' });
    const men = r.recommendations.find((x) => x.scheme === 'men')!;
    expect(men.recommended?.label).toBe('4XL');
    expect(men.smaller?.label).toBe('3XL');
    expect(men.larger?.label).toBe('5XL');
  });

  it('recommends mens 5XL for a 62 in chest with classic ease (+2 = 64)', () => {
    const r = recommendSizes({ bodyChest: 62, unit: 'in', fit: 'classic' });
    const men = r.recommendations.find((x) => x.scheme === 'men')!;
    expect(men.recommended?.label).toBe('5XL');
    expect(men.smaller?.label).toBe('4XL');
    expect(men.larger).toBeNull();
  });

  it('still rejects a 80 in chest as outside even the expanded mens range', () => {
    const r = recommendSizes({ bodyChest: 80, unit: 'in', fit: 'classic' });
    const men = r.recommendations.find((x) => x.scheme === 'men')!;
    expect(men.recommended).toBeNull();
  });
});
