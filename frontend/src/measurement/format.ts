// ── Display formatting functions ────────────────────────────────
// All formatters accept canonical storage values (mm, grams, meters,
// per-10cm) and convert to the user's preferred display units.

import type {
  MeasurementPreferences,
  ToolCategory,
} from './types';
import {
  mmToCm,
  mmToIn,
  gToOz,
  mToYd,
  stitchesPer10CmTo4In,
} from './convert';
import {
  needleByMM,
  hookByMM,
} from './reference';

// ── Tool size formatting ────────────────────────────────────────

/**
 * Format a tool size (in mm) for display based on the tool category
 * and user preferences.
 *
 * Knitting needles use prefs.needleSizeFormat.
 * Crochet hooks use prefs.hookSizeFormat.
 * Accessories show plain mm.
 */
export function formatToolSize(
  sizeMm: number | null | undefined,
  toolCategory: ToolCategory,
  prefs: MeasurementPreferences,
): string {
  if (sizeMm == null) return '\u2014';

  // Accessories: just show mm
  if (toolCategory === 'accessory') {
    return `${sizeMm}mm`;
  }

  // Knitting needles
  if (
    toolCategory === 'knitting_needle_straight' ||
    toolCategory === 'knitting_needle_circular' ||
    toolCategory === 'knitting_needle_dpn'
  ) {
    const n = needleByMM.get(sizeMm);
    const format = prefs.needleSizeFormat;
    if (!n) return `${sizeMm}mm`;

    switch (format) {
      case 'metric':
        return n.us ? `${sizeMm}mm (US ${n.us})` : `${sizeMm}mm`;
      case 'us':
        return n.us ? `US ${n.us} (${sizeMm}mm)` : `${sizeMm}mm`;
      case 'uk':
        return n.uk ? `UK ${n.uk} (${sizeMm}mm)` : `${sizeMm}mm`;
    }
  }

  // Crochet hooks
  if (
    toolCategory === 'crochet_hook_standard' ||
    toolCategory === 'crochet_hook_steel'
  ) {
    const h = hookByMM.get(sizeMm);
    const format = prefs.hookSizeFormat;
    if (!h) return `${sizeMm}mm`;

    switch (format) {
      case 'metric':
        return h.us ? `${sizeMm}mm (${h.us})` : `${sizeMm}mm`;
      case 'us':
        return h.us ? `${h.us} (${sizeMm}mm)` : `${sizeMm}mm`;
      case 'uk':
        return h.uk ? `UK ${h.uk} (${sizeMm}mm)` : `${sizeMm}mm`;
    }
  }

  return `${sizeMm}mm`;
}

// ── Cable length formatting ─────────────────────────────────────

/** Format a cable length (stored as mm) for display */
export function formatCableLength(
  cableLengthMm: number | null | undefined,
  prefs: MeasurementPreferences,
): string {
  if (cableLengthMm == null) return '\u2014';

  switch (prefs.lengthDisplayUnit) {
    case 'mm':
      return `${cableLengthMm} mm`;
    case 'cm':
      return `${mmToCm(cableLengthMm)} cm`;
    case 'in':
    default:
      return `${mmToIn(cableLengthMm)}"`;
  }
}

// ── Gauge formatting ────────────────────────────────────────────

/**
 * Format gauge from canonical per-10cm storage to user's display.
 *
 * Combinations:
 *   per_base + 4in:  "20 sts x 28 rows / 4 in"
 *   per_base + 10cm: "20 sts x 28 rows / 10 cm"
 *   per_unit + 4in:  "5 sts/in x 7 rows/in"
 *   per_unit + 10cm: "2 sts/cm x 2.8 rows/cm"
 */
export function formatGauge(
  stitchesPer10Cm: number | null | undefined,
  rowsPer10Cm: number | null | undefined,
  prefs: MeasurementPreferences,
): string {
  if (stitchesPer10Cm == null && rowsPer10Cm == null) return '\u2014';

  const is4in = prefs.gaugeBase === '4in';
  const isPerUnit = prefs.gaugeDetail === 'per_unit';

  let stsStr = '\u2014';
  let rowsStr = '\u2014';

  if (stitchesPer10Cm != null) {
    if (isPerUnit) {
      if (is4in) {
        // per-10cm -> per-inch: divide by 10, multiply by 2.54
        const perIn = Math.round((stitchesPer10Cm / 10) * 2.54 * 10) / 10;
        stsStr = `${perIn} sts/in`;
      } else {
        const perCm = Math.round((stitchesPer10Cm / 10) * 10) / 10;
        stsStr = `${perCm} sts/cm`;
      }
    } else {
      if (is4in) {
        const per4in = stitchesPer10CmTo4In(stitchesPer10Cm);
        stsStr = `${per4in} sts`;
      } else {
        stsStr = `${stitchesPer10Cm} sts`;
      }
    }
  }

  if (rowsPer10Cm != null) {
    if (isPerUnit) {
      if (is4in) {
        const perIn = Math.round((rowsPer10Cm / 10) * 2.54 * 10) / 10;
        rowsStr = `${perIn} rows/in`;
      } else {
        const perCm = Math.round((rowsPer10Cm / 10) * 10) / 10;
        rowsStr = `${perCm} rows/cm`;
      }
    } else {
      if (is4in) {
        const per4in = stitchesPer10CmTo4In(rowsPer10Cm);
        rowsStr = `${per4in} rows`;
      } else {
        rowsStr = `${rowsPer10Cm} rows`;
      }
    }
  }

  // Build combined string
  if (isPerUnit) {
    if (stitchesPer10Cm != null && rowsPer10Cm != null) {
      return `${stsStr} \u00d7 ${rowsStr}`;
    }
    return stitchesPer10Cm != null ? stsStr : rowsStr;
  }

  // per_base: include the base denominator
  const base = is4in ? '4 in' : '10 cm';
  if (stitchesPer10Cm != null && rowsPer10Cm != null) {
    return `${stsStr} \u00d7 ${rowsStr} / ${base}`;
  }
  return stitchesPer10Cm != null ? `${stsStr} / ${base}` : `${rowsStr} / ${base}`;
}

// ── General measurement formatting ──────────────────────────────

/** Format a length (stored as mm) to user's display unit */
export function formatLength(
  mm: number | null | undefined,
  prefs: MeasurementPreferences,
): string {
  if (mm == null) return '\u2014';

  switch (prefs.lengthDisplayUnit) {
    case 'mm':
      return `${mm} mm`;
    case 'cm':
      return `${mmToCm(mm)} cm`;
    case 'in':
    default:
      return `${mmToIn(mm)}"`;
  }
}

/** Format a weight (stored as grams) to user's display unit */
export function formatWeight(
  g: number | null | undefined,
  prefs: MeasurementPreferences,
): string {
  if (g == null) return '\u2014';

  switch (prefs.weightDisplayUnit) {
    case 'oz':
      return `${gToOz(g)} oz`;
    case 'g':
    default:
      return `${g} g`;
  }
}

/** Format yarn length (stored as meters) to user's display unit */
export function formatYarnLength(
  m: number | null | undefined,
  prefs: MeasurementPreferences,
): string {
  if (m == null) return '\u2014';

  switch (prefs.yarnLengthDisplayUnit) {
    case 'yd':
      return `${mToYd(m)} yd`;
    case 'm':
    default:
      return `${m} m`;
  }
}

// ── Label generators ────────────────────────────────────────────

/** Label for tool size input fields */
export function getToolSizeLabel(
  toolCategory: ToolCategory,
  prefs: MeasurementPreferences,
): string {
  if (toolCategory === 'accessory') return 'Size (mm)';

  if (
    toolCategory === 'knitting_needle_straight' ||
    toolCategory === 'knitting_needle_circular' ||
    toolCategory === 'knitting_needle_dpn'
  ) {
    switch (prefs.needleSizeFormat) {
      case 'metric': return 'Needle size (mm)';
      case 'us':     return 'Needle size (US)';
      case 'uk':     return 'Needle size (UK)';
    }
  }

  if (
    toolCategory === 'crochet_hook_standard' ||
    toolCategory === 'crochet_hook_steel'
  ) {
    switch (prefs.hookSizeFormat) {
      case 'metric': return 'Hook size (mm)';
      case 'us':     return 'Hook size (US)';
      case 'uk':     return 'Hook size (UK)';
    }
  }

  return 'Size';
}

/** Label for cable length input */
export function getCableLengthLabel(prefs: MeasurementPreferences): string {
  switch (prefs.lengthDisplayUnit) {
    case 'mm': return 'Cable length (mm)';
    case 'cm': return 'Cable length (cm)';
    case 'in':
    default:   return 'Cable length (in)';
  }
}

/** Label for gauge stitch count input */
export function getGaugeLabel(prefs: MeasurementPreferences): string {
  if (prefs.gaugeDetail === 'per_unit') {
    return prefs.gaugeBase === '10cm' ? 'sts/cm' : 'sts/in';
  }
  return prefs.gaugeBase === '10cm' ? 'sts / 10 cm' : 'sts / 4 in';
}

/** Label for gauge row count input */
export function getGaugeRowLabel(prefs: MeasurementPreferences): string {
  if (prefs.gaugeDetail === 'per_unit') {
    return prefs.gaugeBase === '10cm' ? 'rows/cm' : 'rows/in';
  }
  return prefs.gaugeBase === '10cm' ? 'rows / 10 cm' : 'rows / 4 in';
}

/** Label for general length fields */
export function getLengthLabel(prefs: MeasurementPreferences): string {
  switch (prefs.lengthDisplayUnit) {
    case 'mm': return 'mm';
    case 'cm': return 'cm';
    case 'in':
    default:   return 'inches';
  }
}

/** Label for weight fields */
export function getWeightLabel(prefs: MeasurementPreferences): string {
  return prefs.weightDisplayUnit === 'oz' ? 'Ounces' : 'Grams';
}

/** Label for yarn length fields */
export function getYarnLengthLabel(prefs: MeasurementPreferences): string {
  return prefs.yarnLengthDisplayUnit === 'm' ? 'Meters' : 'Yards';
}

/** Short label for yarn length */
export function getYarnLengthLabelShort(prefs: MeasurementPreferences): string {
  return prefs.yarnLengthDisplayUnit === 'm' ? 'm' : 'yd';
}

/** Short label for weight */
export function getWeightLabelShort(prefs: MeasurementPreferences): string {
  return prefs.weightDisplayUnit === 'oz' ? 'oz' : 'g';
}
