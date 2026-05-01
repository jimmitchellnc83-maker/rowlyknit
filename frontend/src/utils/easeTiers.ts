// Canonical ease vocabulary per Craft Yarn Council:
// https://www.craftyarncouncil.com/standards/fit-and-ease (5-tier scale).
//
// Single source of truth for ease tiers used by both the GiftSize calculator
// and the Pattern Designer's body block. Numeric ease values are stored in
// INCHES (CYC standard); consumers convert at presentation time.

export type EaseTier = 'very_close' | 'close' | 'classic' | 'loose' | 'oversized';

export const EASE_TIERS: readonly EaseTier[] = [
  'very_close',
  'close',
  'classic',
  'loose',
  'oversized',
];

export const EASE_TIER_INCHES: Record<EaseTier, number> = {
  very_close: -2,
  close: 0,
  classic: 2,
  loose: 4,
  oversized: 6,
};

export const EASE_TIER_LABELS: Record<EaseTier, string> = {
  very_close: 'Very close',
  close: 'Close',
  classic: 'Classic',
  loose: 'Loose',
  oversized: 'Oversized',
};

// Verbose labels that include the inches/cm hint — used in the calculator
// dropdown so users see the numeric ease alongside the tier name.
export const EASE_TIER_VERBOSE_LABELS: Record<EaseTier, string> = {
  very_close: 'Very close (-2 in / -5 cm)',
  close: 'Close (0 in / 0 cm)',
  classic: 'Classic (+2 in / +5 cm)',
  loose: 'Loose (+4 in / +10 cm)',
  oversized: 'Oversized (+6 in / +15 cm)',
};

// Find the tier (if any) that matches a numeric ease value within a small
// tolerance. Returns null when the user has typed a custom ease that doesn't
// land on a canonical tier.
export function tierForEaseInches(easeIn: number, tolerance = 0.01): EaseTier | null {
  for (const tier of EASE_TIERS) {
    if (Math.abs(EASE_TIER_INCHES[tier] - easeIn) <= tolerance) {
      return tier;
    }
  }
  return null;
}

