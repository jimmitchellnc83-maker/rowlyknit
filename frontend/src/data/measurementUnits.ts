// ── Thin re-export bridge ───────────────────────────────────────
// Backward-compatible re-exports from the measurement module.
// New code should import directly from '../measurement'.

// ── Types ───────────────────────────────────────────────────────

import type {
  NeedleSizeFormat as _NeedleSizeFormat,
  GaugeBase,
  GaugeDetail,
} from '../measurement/types';

export type NeedleSizeFormat = _NeedleSizeFormat;
export type { GaugeBase, GaugeDetail };

// Legacy type aliases -- old code used these names
export type LengthUnit = 'in' | 'cm';
export type YarnQuantityUnit = 'yd' | 'm';
export type YarnWeightUnit = 'g' | 'oz';

// Old MeasurementPreferences interface for backward compatibility.
// Uses the old field names (lengthUnit, yarnQuantityUnit, etc.).
export interface MeasurementPreferences {
  needleSizeFormat: NeedleSizeFormat;
  lengthUnit: LengthUnit;
  yarnQuantityUnit: YarnQuantityUnit;
  yarnWeightUnit: YarnWeightUnit;
  gaugeBase: GaugeBase;
  gaugeDetail: GaugeDetail;
}

export const DEFAULT_PREFS: MeasurementPreferences = {
  needleSizeFormat: 'us',
  lengthUnit: 'in',
  yarnQuantityUnit: 'yd',
  yarnWeightUnit: 'g',
  gaugeBase: '4in',
  gaugeDetail: 'per_base',
};

// ── Conversions ─────────────────────────────────────────────────

import {
  inToCm as _inToCm,
  cmToIn as _cmToIn,
  mmToIn as _mmToIn,
  inToMm as _inToMm,
  gToOz as _gToOz,
  ozToG as _ozToG,
  gToLb as _gToLb,
  lbToG as _lbToG,
  wpiToApproxMm as _wpiToApproxMm,
  yppToMpkg as _yppToMpkg,
  mpkgToYpp as _mpkgToYpp,
  ydToM as _ydToM,
  mToYd as _mToYd,
  stitchesPer4InTo10Cm as _stitchesPer4InTo10Cm,
  stitchesPer10CmTo4In as _stitchesPer10CmTo4In,
} from '../measurement/convert';

export const inToCm = _inToCm;
export const cmToIn = _cmToIn;
export const mmToIn = _mmToIn;
export const inToMm = _inToMm;
export const gToOz = _gToOz;
export const ozToG = _ozToG;
export const gToLb = _gToLb;
export const lbToG = _lbToG;
export const wpiToApproxMm = _wpiToApproxMm;
export const yppToMpkg = _yppToMpkg;
export const mpkgToYpp = _mpkgToYpp;

// Old names: ydsToMeters / metersToYds
export const ydsToMeters = _ydToM;
export const metersToYds = _mToYd;

// Gauge conversions -- old used gauge4inTo10cm / gauge10cmTo4in
export const gauge4inTo10cm = _stitchesPer4InTo10Cm;
export const gauge10cmTo4in = _stitchesPer10CmTo4In;

// ── Display formatters ──────────────────────────────────────────
// These accept the legacy MeasurementPreferences shape.

export function formatYardage(value: number | null | undefined, prefs: MeasurementPreferences): string {
  if (value == null) return '\u2014';
  if (prefs.yarnQuantityUnit === 'm') return `${ydsToMeters(value)} m`;
  return `${value} yds`;
}

export function formatYardageRaw(value: number | null | undefined, prefs: MeasurementPreferences): number | null {
  if (value == null) return null;
  return prefs.yarnQuantityUnit === 'm' ? ydsToMeters(value) : value;
}

export function formatWeight(value: number | null | undefined, prefs: MeasurementPreferences): string {
  if (value == null) return '\u2014';
  if (prefs.yarnWeightUnit === 'oz') return `${gToOz(value)} oz`;
  return `${value} g`;
}

export function formatLength(value: number | null | undefined, prefs: MeasurementPreferences): string {
  if (value == null) return '\u2014';
  if (prefs.lengthUnit === 'cm') return `${inToCm(value)} cm`;
  return `${value}"`;
}

export function formatGaugeBase(prefs: MeasurementPreferences): string {
  return prefs.gaugeBase === '10cm' ? '10 cm' : '4 inches';
}

// ── Labels ──────────────────────────────────────────────────────

export function getYardageLabel(prefs: MeasurementPreferences): string {
  return prefs.yarnQuantityUnit === 'm' ? 'Meters' : 'Yards';
}
export function getYardageLabelShort(prefs: MeasurementPreferences): string {
  return prefs.yarnQuantityUnit === 'm' ? 'm' : 'yds';
}
export function getWeightLabel(prefs: MeasurementPreferences): string {
  return prefs.yarnWeightUnit === 'oz' ? 'Ounces' : 'Grams';
}
export function getWeightLabelShort(prefs: MeasurementPreferences): string {
  return prefs.yarnWeightUnit === 'oz' ? 'oz' : 'g';
}
export function getLengthLabel(prefs: MeasurementPreferences): string {
  return prefs.lengthUnit === 'cm' ? 'cm' : 'inches';
}
export function getLengthLabelShort(prefs: MeasurementPreferences): string {
  return prefs.lengthUnit === 'cm' ? 'cm' : 'in';
}

export function getGaugeLabel(prefs: MeasurementPreferences): string {
  if (prefs.gaugeDetail === 'per_unit') {
    return prefs.gaugeBase === '10cm' ? 'sts/cm' : 'sts/in';
  }
  return prefs.gaugeBase === '10cm' ? 'sts / 10 cm' : 'sts / 4 in';
}

export function getGaugeRowLabel(prefs: MeasurementPreferences): string {
  if (prefs.gaugeDetail === 'per_unit') {
    return prefs.gaugeBase === '10cm' ? 'rows/cm' : 'rows/in';
  }
  return prefs.gaugeBase === '10cm' ? 'rows / 10 cm' : 'rows / 4 in';
}

// ── Preference option metadata (for Settings UI) ────────────────

export const PREFERENCE_OPTIONS = {
  needleSizeFormat: [
    { value: 'us', label: 'US sizes', description: 'US 7 (4.5mm)' },
    { value: 'metric', label: 'Metric (mm)', description: '4.5mm (US 7)' },
    { value: 'uk', label: 'UK sizes', description: 'UK 7 (4.5mm)' },
  ],
  lengthUnit: [
    { value: 'in', label: 'Inches', description: 'Imperial measurements' },
    { value: 'cm', label: 'Centimeters', description: 'Metric measurements' },
  ],
  yarnQuantityUnit: [
    { value: 'yd', label: 'Yards', description: 'Yarn length in yards' },
    { value: 'm', label: 'Meters', description: 'Yarn length in meters' },
  ],
  yarnWeightUnit: [
    { value: 'g', label: 'Grams', description: 'Skein weight in grams' },
    { value: 'oz', label: 'Ounces', description: 'Skein weight in ounces' },
  ],
  gaugeBase: [
    { value: '4in', label: '4 inches', description: 'Standard US swatch (4" x 4")' },
    { value: '10cm', label: '10 cm', description: 'Standard metric swatch (10 cm x 10 cm)' },
  ],
  gaugeDetail: [
    { value: 'per_base', label: 'Per swatch', description: '20 sts / 4 in -- standard pattern format' },
    { value: 'per_unit', label: 'Per unit', description: '5 sts/in -- compact format' },
  ],
} as const;
