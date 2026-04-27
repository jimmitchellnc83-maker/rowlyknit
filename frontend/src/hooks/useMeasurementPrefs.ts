import { useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';

// Import from the new measurement module
import type {
  MeasurementPreferences,
  ToolCategory,
} from '../measurement/types';

import {
  DEFAULT_PREFS,
} from '../measurement/types';

import {
  inToCm,
  cmToIn,
  gToOz,
  ozToG,
  mToYd,
  ydToM,
  mmToIn,
} from '../measurement/convert';

import {
  formatToolSize,
  formatCableLength,
  formatGauge,
  formatLength,
  formatWeight,
  formatYarnLength,
  getGaugeLabel,
  getGaugeRowLabel,
  getLengthLabel,
  getWeightLabel,
  getWeightLabelShort,
  getYarnLengthLabel,
  getYarnLengthLabelShort,
} from '../measurement/format';

import { needleByMM, hookByMM } from '../measurement/reference';

// Re-export MeasurementPreferences from here so existing imports
// from this hook continue to work.
export type { MeasurementPreferences } from '../measurement/types';

/**
 * Returns the user's measurement preferences (with defaults) and
 * pre-bound formatter/label functions. Use this everywhere measurements appear.
 *
 * Usage:
 *   const { prefs, fmt, labels } = useMeasurementPrefs();
 *   <span>{fmt.yardage(tool.yards)}</span>
 *   <label>{labels.yardage} per Skein</label>
 *   <span>{fmt.needleSize(4.5)}</span>  -> "US 7 (4.5mm)" or "4.5mm (US 7)"
 *   <span>{fmt.toolSize(4.5, 'knitting_needle_straight')}</span>
 *   <span>{fmt.cableLength(609.6)}</span>
 *   <span>{fmt.gauge(20, 28)}</span>
 */
export function useMeasurementPrefs() {
  const user = useAuthStore((s) => s.user);

  const prefs: MeasurementPreferences = useMemo(() => {
    const raw = (user?.preferences?.measurements || {}) as Record<string, unknown>;

    // Map legacy field names → new names, then overlay on defaults
    const mapped: Partial<MeasurementPreferences> = {};

    if (raw.needleSizeFormat) mapped.needleSizeFormat = raw.needleSizeFormat as MeasurementPreferences['needleSizeFormat'];
    if (raw.hookSizeFormat) mapped.hookSizeFormat = raw.hookSizeFormat as MeasurementPreferences['hookSizeFormat'];
    if (raw.gaugeBase) mapped.gaugeBase = raw.gaugeBase as MeasurementPreferences['gaugeBase'];
    if (raw.gaugeDetail) mapped.gaugeDetail = raw.gaugeDetail as MeasurementPreferences['gaugeDetail'];

    if (raw.lengthDisplayUnit) mapped.lengthDisplayUnit = raw.lengthDisplayUnit as MeasurementPreferences['lengthDisplayUnit'];
    if (raw.weightDisplayUnit) mapped.weightDisplayUnit = raw.weightDisplayUnit as MeasurementPreferences['weightDisplayUnit'];
    if (raw.yarnLengthDisplayUnit) mapped.yarnLengthDisplayUnit = raw.yarnLengthDisplayUnit as MeasurementPreferences['yarnLengthDisplayUnit'];

    // Inherit hookSizeFormat from needleSizeFormat if not set separately
    if (mapped.needleSizeFormat && !mapped.hookSizeFormat) {
      mapped.hookSizeFormat = mapped.needleSizeFormat;
    }

    return { ...DEFAULT_PREFS, ...mapped };
  }, [user?.preferences?.measurements]);

  const fmt = useMemo(() => ({
    // ── Legacy formatters (kept for backward compat) ──────────────
    // These accept values stored in the old imperial-first schema
    // (yards, inches, grams). They still work correctly.
    yardage: (v: number | null | undefined) => {
      if (v == null) return '\u2014';
      if (prefs.yarnLengthDisplayUnit === 'm') return `${ydToM(v)} m`;
      return `${v} yds`;
    },
    yardageRaw: (v: number | null | undefined): number | null => {
      if (v == null) return null;
      return prefs.yarnLengthDisplayUnit === 'm' ? ydToM(v) : v;
    },
    weight: (v: number | null | undefined) => {
      if (v == null) return '\u2014';
      if (prefs.weightDisplayUnit === 'oz') return `${gToOz(v)} oz`;
      return `${v} g`;
    },
    length: (v: number | null | undefined) => {
      if (v == null) return '\u2014';
      switch (prefs.lengthDisplayUnit) {
        case 'cm': return `${inToCm(v)} cm`;
        case 'mm': return `${Math.round(v * 25.4 * 10) / 10} mm`;
        case 'in':
        default:   return `${v}"`;
      }
    },
    gaugeBase: () => prefs.gaugeBase === '10cm' ? '10 cm' : '4 inches',

    // Legacy needle/hook formatters (mm, format) -> string
    needleSize: (mm: number | null | undefined) => {
      if (mm == null) return '\u2014';
      const n = needleByMM.get(mm);
      if (!n) return `${mm}mm`;
      const format = prefs.needleSizeFormat;
      switch (format) {
        case 'metric': return n.us ? `${mm}mm (US ${n.us})` : `${mm}mm`;
        case 'us':     return n.us ? `US ${n.us} (${mm}mm)` : `${mm}mm`;
        case 'uk':     return n.uk ? `UK ${n.uk} (${mm}mm)` : `${mm}mm`;
      }
    },
    hookSize: (mm: number | null | undefined) => {
      if (mm == null) return '\u2014';
      const h = hookByMM.get(mm);
      if (!h) return `${mm}mm`;
      const format = prefs.hookSizeFormat;
      switch (format) {
        case 'metric': return h.us ? `${mm}mm (${h.us})` : `${mm}mm`;
        case 'us':     return h.us ? `${h.us} (${mm}mm)` : `${mm}mm`;
        case 'uk':     return h.uk ? `UK ${h.uk} (${mm}mm)` : `${mm}mm`;
      }
    },

    // ── New formatters from measurement module ────────────────────
    /** Format a tool size using the full measurement module logic */
    toolSize: (sizeMm: number | null | undefined, toolCategory: ToolCategory) =>
      formatToolSize(sizeMm, toolCategory, prefs),

    /** Format cable length (stored as mm) for display */
    cableLength: (cableLengthMm: number | null | undefined) =>
      formatCableLength(cableLengthMm, prefs),

    /** Format gauge from canonical per-10cm storage */
    gauge: (stitchesPer10Cm: number | null | undefined, rowsPer10Cm: number | null | undefined) =>
      formatGauge(stitchesPer10Cm, rowsPer10Cm, prefs),

    /** Format yarn length (stored as meters) */
    yarnLength: (meters: number | null | undefined) =>
      formatYarnLength(meters, prefs),

    /** Format length (stored as mm) */
    lengthMm: (mm: number | null | undefined) =>
      formatLength(mm, prefs),

    /** Format weight (stored as grams) using new module */
    weightG: (g: number | null | undefined) =>
      formatWeight(g, prefs),

    // ── Converters ────────────────────────────────────────────────
    // Convert DB value (stored imperial) to display value
    convertYardage: (yds: number) => prefs.yarnLengthDisplayUnit === 'm' ? ydToM(yds) : yds,
    convertLength: (inches: number) => {
      switch (prefs.lengthDisplayUnit) {
        case 'cm': return inToCm(inches);
        case 'mm': return Math.round(inches * 25.4 * 10) / 10;
        case 'in':
        default:   return inches;
      }
    },
    convertWeight: (grams: number) => prefs.weightDisplayUnit === 'oz' ? gToOz(grams) : grams,
    // Reverse converters — convert user input back to DB units
    inputToYards: (val: number) => prefs.yarnLengthDisplayUnit === 'm' ? mToYd(val) : val,
    inputToInches: (val: number) => {
      switch (prefs.lengthDisplayUnit) {
        case 'cm': return cmToIn(val);
        case 'mm': return mmToIn(val);
        case 'in':
        default:   return val;
      }
    },
    inputToGrams: (val: number) => prefs.weightDisplayUnit === 'oz' ? ozToG(val) : val,
  }), [prefs]);

  const labels = useMemo(() => ({
    yardage: getYarnLengthLabel(prefs),
    yardageShort: getYarnLengthLabelShort(prefs),
    weight: getWeightLabel(prefs),
    weightShort: getWeightLabelShort(prefs),
    length: getLengthLabel(prefs),
    lengthShort: getLengthLabel(prefs),
    gauge: getGaugeLabel(prefs),
    gaugeRow: getGaugeRowLabel(prefs),
    gaugeBase: prefs.gaugeBase === '10cm' ? '10 cm' : '4 inches',
  }), [prefs]);

  return { prefs, fmt, labels };
}
