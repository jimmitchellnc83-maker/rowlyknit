/**
 * Pure math for the Gift Size Calculator.
 *
 * Knitwear "size" is a function of body measurement + ease: a 38 in bust
 * with 4 in positive ease calls for a finished garment of 42 in. This
 * utility recommends a size from common sizing schemes (women, men,
 * children, babies) given a body measurement and a target ease preset,
 * and reports the resulting finished-garment circumference.
 *
 * Size tables are CYC / Craft Yarn Council standard bust/chest ranges.
 * Values are the GARMENT finished-chest circumference for each size.
 * A size "fits" a target finished chest when that value falls within
 * the size's range (or is closest to the midpoint among schemes where
 * sizes overlap).
 *
 * **Units:** inches are CYC's authoritative unit for body sizing — the
 * cm cells in CYC's plus-size charts contain transcription errors. We
 * store the size tables in inches and convert cm input via the canonical
 * 2.54 factor.
 *
 * Kept client-side — stateless, offline-friendly.
 */

import { EASE_TIER_INCHES, type EaseTier } from './easeTiers';

export type MeasurementUnit = 'in' | 'cm';

// Re-exported for callers that still talk in "fit style" terms.
export type FitStyle = EaseTier;

export type SizeScheme = 'women' | 'men' | 'child' | 'baby';

export interface SizeEntry {
  label: string;
  /** Inclusive-inclusive chest range the size is designed to fit (inches). */
  minChest: number;
  maxChest: number;
}

/**
 * CYC women's finished-bust circumference ranges (in inches). XS at 28–30,
 * XL near the top of the standard range. These are designed-to-fit ranges,
 * i.e. the expected final garment chest after ease.
 */
export const WOMEN_SIZES: SizeEntry[] = [
  { label: 'XS', minChest: 28, maxChest: 30 },
  { label: 'S', minChest: 32, maxChest: 34 },
  { label: 'M', minChest: 36, maxChest: 38 },
  { label: 'L', minChest: 40, maxChest: 42 },
  { label: 'XL', minChest: 44, maxChest: 46 },
  { label: '2XL', minChest: 48, maxChest: 50 },
  { label: '3XL', minChest: 52, maxChest: 54 },
  { label: '4XL', minChest: 56, maxChest: 58 },
  { label: '5XL', minChest: 60, maxChest: 62 },
];

/**
 * CYC men's finished-chest circumference ranges (in inches). Plus sizes
 * 4XL (60–62) and 5XL (64–66) round out the standard chart so a 60+ in
 * recipient gets a useful recommendation rather than falling off the end
 * of the table.
 */
export const MEN_SIZES: SizeEntry[] = [
  { label: 'XS', minChest: 32, maxChest: 34 },
  { label: 'S', minChest: 36, maxChest: 38 },
  { label: 'M', minChest: 40, maxChest: 42 },
  { label: 'L', minChest: 44, maxChest: 46 },
  { label: 'XL', minChest: 48, maxChest: 50 },
  { label: '2XL', minChest: 52, maxChest: 54 },
  { label: '3XL', minChest: 56, maxChest: 58 },
  { label: '4XL', minChest: 60, maxChest: 62 },
  { label: '5XL', minChest: 64, maxChest: 66 },
];

/** Children's chest-by-age sizing (CYC standard). */
export const CHILD_SIZES: SizeEntry[] = [
  { label: '2', minChest: 21, maxChest: 22 },
  { label: '4', minChest: 23, maxChest: 24 },
  { label: '6', minChest: 25, maxChest: 26.5 },
  { label: '8', minChest: 27, maxChest: 28 },
  { label: '10', minChest: 28.5, maxChest: 30 },
  { label: '12', minChest: 30, maxChest: 31.5 },
  { label: '14', minChest: 31.5, maxChest: 32.5 },
];

export const BABY_SIZES: SizeEntry[] = [
  { label: '0–3 mo', minChest: 16, maxChest: 17 },
  { label: '3–6 mo', minChest: 17, maxChest: 18 },
  { label: '6–12 mo', minChest: 18, maxChest: 19 },
  { label: '12–18 mo', minChest: 19, maxChest: 20 },
  { label: '18–24 mo', minChest: 20, maxChest: 21 },
];

const SCHEMES: Record<SizeScheme, SizeEntry[]> = {
  women: WOMEN_SIZES,
  men: MEN_SIZES,
  child: CHILD_SIZES,
  baby: BABY_SIZES,
};

export const SCHEME_LABELS: Record<SizeScheme, string> = {
  women: "Women's",
  men: "Men's",
  child: 'Children',
  baby: 'Babies',
};

const CM_PER_IN = 2.54;

function toInches(value: number, unit: MeasurementUnit): number {
  return unit === 'cm' ? value / CM_PER_IN : value;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export interface SizeRecommendation {
  scheme: SizeScheme;
  /** Best-fit size entry, or null if the target is outside the scheme's range. */
  recommended: SizeEntry | null;
  /** Alternatives one step smaller / larger, if available. */
  smaller: SizeEntry | null;
  larger: SizeEntry | null;
  /** Why this size was picked — human-readable. */
  reason: string;
}

export interface GiftSizeResult {
  /** Body chest in inches (normalized from user input). */
  bodyChestIn: number;
  /** Ease applied in inches (from fit style or custom). */
  easeIn: number;
  /** Target finished garment chest in inches. */
  finishedChestIn: number;
  /** Per-scheme recommendations. */
  recommendations: SizeRecommendation[];
}

/**
 * Recommend a size across all common schemes given a body measurement and
 * a fit style. Pass either a `FitStyle` or a raw ease amount; if both are
 * provided, `customEaseIn` wins (lets advanced users override).
 */
export function recommendSizes(input: {
  bodyChest: number;
  unit: MeasurementUnit;
  fit: FitStyle;
  customEaseIn?: number | null;
}): GiftSizeResult {
  const bodyChestIn = toInches(input.bodyChest, input.unit);
  const easeIn =
    input.customEaseIn != null && Number.isFinite(input.customEaseIn)
      ? input.customEaseIn
      : EASE_TIER_INCHES[input.fit];
  const finishedChestIn = round1(bodyChestIn + easeIn);

  const recommendations = (Object.keys(SCHEMES) as SizeScheme[]).map<SizeRecommendation>(
    (scheme) => {
      const table = SCHEMES[scheme];
      const result = pickSize(table, finishedChestIn);
      return { scheme, ...result };
    },
  );

  return {
    bodyChestIn: round1(bodyChestIn),
    easeIn: round1(easeIn),
    finishedChestIn,
    recommendations,
  };
}

/**
 * Find the size whose range contains the target, or the closest by
 * midpoint distance if no exact containment. Returns null if the target is
 * outside the scheme's overall range (e.g. adult chest in a baby scheme).
 */
function pickSize(
  table: SizeEntry[],
  target: number,
): Pick<SizeRecommendation, 'recommended' | 'smaller' | 'larger' | 'reason'> {
  const min = table[0].minChest;
  const max = table[table.length - 1].maxChest;
  if (target < min - 2 || target > max + 2) {
    return {
      recommended: null,
      smaller: null,
      larger: null,
      reason: `Target (${target} in) is outside this scheme's range (${min}–${max} in).`,
    };
  }

  // Pass 1: exact containment.
  const exactIdx = table.findIndex((s) => target >= s.minChest && target <= s.maxChest);
  let idx = exactIdx;
  let reason: string;
  if (exactIdx >= 0) {
    reason = `${target} in falls inside the ${table[exactIdx].label} range (${table[exactIdx].minChest}–${table[exactIdx].maxChest} in).`;
  } else {
    // Pass 2: closest midpoint.
    idx = table.reduce<{ idx: number; distance: number }>(
      (acc, size, i) => {
        const mid = (size.minChest + size.maxChest) / 2;
        const d = Math.abs(mid - target);
        return d < acc.distance ? { idx: i, distance: d } : acc;
      },
      { idx: 0, distance: Infinity },
    ).idx;
    reason = `${target} in is between sizes; ${table[idx].label} (${table[idx].minChest}–${table[idx].maxChest} in) is closest by midpoint.`;
  }

  return {
    recommended: table[idx],
    smaller: idx > 0 ? table[idx - 1] : null,
    larger: idx < table.length - 1 ? table[idx + 1] : null,
    reason,
  };
}
