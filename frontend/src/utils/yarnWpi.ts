// Helpers for the optional Wraps-Per-Inch (WPI) field on yarn.
//
// WPI is the canonical CYC measurement for classifying yarn thickness:
// wrap the yarn around a 1-inch ruler with no overlap, count the wraps.
// CYC publishes a range per weight category; this module exposes the
// range + a midpoint default per stored weight string (lace/fingering/...).
//
// Source: Craft Yarn Council of America's www.YarnStandards.com.

import { YARN_WEIGHT_CATEGORIES } from '../measurement/reference';
import type { YarnWeightCategory } from '../measurement/types';

// Stored weight strings as written by YarnStash forms.
export type YarnWeight =
  | 'lace'
  | 'fingering'
  | 'sport'
  | 'dk'
  | 'worsted'
  | 'bulky'
  | 'super-bulky';

// Maps stored weight aliases onto the matching CYC category number.
const WEIGHT_TO_CYC_NUMBER: Record<YarnWeight, number> = {
  lace: 0,
  fingering: 1,
  sport: 2,
  dk: 3,
  worsted: 4,
  bulky: 5,
  'super-bulky': 6,
};

export function categoryForWeight(weight: string | null | undefined): YarnWeightCategory | null {
  if (!weight) return null;
  const key = weight.toLowerCase().trim() as YarnWeight;
  const cycNumber = WEIGHT_TO_CYC_NUMBER[key];
  if (cycNumber == null) return null;
  return YARN_WEIGHT_CATEGORIES.find((c) => c.number === cycNumber) ?? null;
}

export interface WpiRange {
  min: number;
  max: number;
  /** Midpoint used as the placeholder default for the form input. */
  default: number;
}

export function wpiRangeForWeight(weight: string | null | undefined): WpiRange | null {
  const category = categoryForWeight(weight);
  if (!category || category.wpiMin == null || category.wpiMax == null) return null;
  const mid = Math.round(((category.wpiMin + category.wpiMax) / 2) * 10) / 10;
  return { min: category.wpiMin, max: category.wpiMax, default: mid };
}

// Best-effort reverse classifier: given a measured WPI, return the closest
// CYC weight category. Returns null when WPI is outside every defined range.
export function weightForWpi(wpi: number): YarnWeightCategory | null {
  if (!Number.isFinite(wpi)) return null;
  const matches = YARN_WEIGHT_CATEGORIES.filter(
    (c) => c.wpiMin != null && c.wpiMax != null && wpi >= c.wpiMin && wpi <= c.wpiMax,
  );
  if (matches.length === 0) return null;
  // WPI ranges overlap (Lace 30-40 vs Super Fine 14-30); when multiple match,
  // pick the one whose midpoint is closest to the measured value.
  return matches.reduce((best, current) => {
    const bestMid = ((best.wpiMin ?? 0) + (best.wpiMax ?? 0)) / 2;
    const currentMid = ((current.wpiMin ?? 0) + (current.wpiMax ?? 0)) / 2;
    return Math.abs(currentMid - wpi) < Math.abs(bestMid - wpi) ? current : best;
  });
}
