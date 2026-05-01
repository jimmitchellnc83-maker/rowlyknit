import { describe, it, expect } from 'vitest';
import {
  EASE_TIERS,
  EASE_TIER_INCHES,
  EASE_TIER_LABELS,
  EASE_TIER_VERBOSE_LABELS,
  tierForEaseInches,
} from './easeTiers';

describe('easeTiers', () => {
  it('exposes 5 canonical CYC tiers in stretch order', () => {
    expect(EASE_TIERS).toEqual(['very_close', 'close', 'classic', 'loose', 'oversized']);
  });

  it('inches table matches CYC standard convention', () => {
    expect(EASE_TIER_INCHES).toEqual({
      very_close: -2,
      close: 0,
      classic: 2,
      loose: 4,
      oversized: 6,
    });
  });

  it('labels and verbose labels cover every tier', () => {
    for (const tier of EASE_TIERS) {
      expect(EASE_TIER_LABELS[tier]).toBeTruthy();
      expect(EASE_TIER_VERBOSE_LABELS[tier]).toMatch(/in/);
    }
  });
});

describe('tierForEaseInches', () => {
  it('back-projects each canonical preset onto its tier', () => {
    expect(tierForEaseInches(-2)).toBe('very_close');
    expect(tierForEaseInches(0)).toBe('close');
    expect(tierForEaseInches(2)).toBe('classic');
    expect(tierForEaseInches(4)).toBe('loose');
    expect(tierForEaseInches(6)).toBe('oversized');
  });

  it('returns null for non-canonical custom ease', () => {
    expect(tierForEaseInches(1)).toBeNull();
    expect(tierForEaseInches(3.5)).toBeNull();
    expect(tierForEaseInches(8)).toBeNull();
  });

  it('respects a tolerance for fuzzy matches', () => {
    expect(tierForEaseInches(2.04, 0.05)).toBe('classic');
    expect(tierForEaseInches(2.1, 0.05)).toBeNull();
  });
});
