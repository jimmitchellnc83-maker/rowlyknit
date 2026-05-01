import { describe, it, expect } from 'vitest';
import { categoryForWeight, weightForWpi, wpiRangeForWeight } from './yarnWpi';

describe('categoryForWeight', () => {
  it('maps each stored alias to the matching CYC category', () => {
    expect(categoryForWeight('lace')?.number).toBe(0);
    expect(categoryForWeight('fingering')?.number).toBe(1);
    expect(categoryForWeight('sport')?.number).toBe(2);
    expect(categoryForWeight('dk')?.number).toBe(3);
    expect(categoryForWeight('worsted')?.number).toBe(4);
    expect(categoryForWeight('bulky')?.number).toBe(5);
    expect(categoryForWeight('super-bulky')?.number).toBe(6);
  });

  it('is case-insensitive and tolerates whitespace', () => {
    expect(categoryForWeight(' Worsted ')?.number).toBe(4);
    expect(categoryForWeight('DK')?.number).toBe(3);
  });

  it('returns null for unknown / empty values', () => {
    expect(categoryForWeight(null)).toBeNull();
    expect(categoryForWeight(undefined)).toBeNull();
    expect(categoryForWeight('')).toBeNull();
    expect(categoryForWeight('chunky')).toBeNull();
  });
});

describe('wpiRangeForWeight', () => {
  it('returns the CYC range and a midpoint default', () => {
    expect(wpiRangeForWeight('worsted')).toEqual({ min: 9, max: 12, default: 10.5 });
    expect(wpiRangeForWeight('lace')).toEqual({ min: 30, max: 40, default: 35 });
    expect(wpiRangeForWeight('super-bulky')).toEqual({ min: 5, max: 8, default: 6.5 });
  });

  it('returns null for unknown weights', () => {
    expect(wpiRangeForWeight('chunky')).toBeNull();
  });
});

describe('weightForWpi', () => {
  it('classifies measured WPI onto the closest CYC category by midpoint', () => {
    expect(weightForWpi(35)?.number).toBe(0); // Lace 30-40
    expect(weightForWpi(20)?.number).toBe(1); // Super Fine 14-30
    expect(weightForWpi(13)?.number).toBe(3); // Fine 12-18 + Light 11-15 both match; Light's midpoint (13) wins
    expect(weightForWpi(10)?.number).toBe(4); // Medium 9-12
    expect(weightForWpi(8)?.number).toBe(5); // Bulky 7-10
  });

  it('returns null when WPI sits outside every range', () => {
    expect(weightForWpi(0)).toBeNull();
    expect(weightForWpi(100)).toBeNull();
  });

  it('rejects non-finite input', () => {
    expect(weightForWpi(NaN)).toBeNull();
    expect(weightForWpi(Infinity)).toBeNull();
  });
});
