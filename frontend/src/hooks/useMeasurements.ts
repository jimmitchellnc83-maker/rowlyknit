import { useAuthStore } from '../stores/authStore';

/** Shape of the measurements sub-object inside user preferences */
interface MeasurementPrefs {
  needleSizeFormat: 'us' | 'mm' | 'uk';
  lengthUnit: 'in' | 'cm' | 'mm';
  yarnQuantityUnit: 'yd' | 'm';
  yarnWeightUnit: 'g' | 'oz';
  gaugeBase: '4in' | '10cm';
  gaugeDetail: 'per_base' | 'per_inch' | 'per_cm';
}

const DEFAULTS: MeasurementPrefs = {
  needleSizeFormat: 'us',
  lengthUnit: 'in',
  yarnQuantityUnit: 'yd',
  yarnWeightUnit: 'g',
  gaugeBase: '4in',
  gaugeDetail: 'per_base',
};

const M_TO_YD = 1.09361;
const CM_PER_IN = 2.54;

/**
 * Hook that reads the current user's measurement preferences and returns
 * a `fmt` object with helpers for displaying yarn length, gauge, and
 * needle cable length in the user's chosen units.
 */
export function useMeasurements() {
  const user = useAuthStore((s) => s.user);
  const raw = (user?.preferences?.measurements ?? {}) as Record<string, unknown>;

  // The canonical schema (post PR #230 + migration #061) uses the
  // *DisplayUnit field names. This legacy hook still surfaces the
  // pre-rename names to its consumers, so we map on read.
  const prefs: MeasurementPrefs = {
    ...DEFAULTS,
    ...(raw.needleSizeFormat ? { needleSizeFormat: raw.needleSizeFormat as MeasurementPrefs['needleSizeFormat'] } : {}),
    ...(raw.lengthDisplayUnit ? { lengthUnit: raw.lengthDisplayUnit as MeasurementPrefs['lengthUnit'] } : {}),
    ...(raw.yarnLengthDisplayUnit ? { yarnQuantityUnit: raw.yarnLengthDisplayUnit as MeasurementPrefs['yarnQuantityUnit'] } : {}),
    ...(raw.weightDisplayUnit ? { yarnWeightUnit: raw.weightDisplayUnit as MeasurementPrefs['yarnWeightUnit'] } : {}),
    ...(raw.gaugeBase ? { gaugeBase: raw.gaugeBase as MeasurementPrefs['gaugeBase'] } : {}),
    ...(raw.gaugeDetail ? { gaugeDetail: raw.gaugeDetail as MeasurementPrefs['gaugeDetail'] } : {}),
  };

  const fmt = {
    /**
     * Format a yarn length stored in meters to the user's preferred unit.
     * Returns e.g. "220 yd" or "201 m".
     * Falls back to yards_total/yards_remaining when meter value is null.
     */
    yarnLength(meters: number | null | undefined, fallbackYards?: number | null): string {
      if (meters == null && fallbackYards == null) return '—';
      if (meters != null) {
        if (prefs.yarnQuantityUnit === 'yd') {
          return `${Math.round(meters * M_TO_YD)} yd`;
        }
        return `${Math.round(meters)} m`;
      }
      // Fallback from legacy yards column
      if (fallbackYards != null) {
        if (prefs.yarnQuantityUnit === 'm') {
          return `${Math.round(fallbackYards / M_TO_YD)} m`;
        }
        return `${Math.round(fallbackYards)} yd`;
      }
      return '—';
    },

    /** The unit label for yarn length ("yd" or "m") */
    yarnLengthUnit(): string {
      return prefs.yarnQuantityUnit === 'm' ? 'm' : 'yd';
    },

    /**
     * Format gauge stored as stitches/rows per 10 cm.
     * Returns e.g. "20 sts / 28 rows per 4 in" or "20 sts / 28 rows per 10 cm".
     */
    gauge(
      stitchesPer10cm: number | null | undefined,
      rowsPer10cm: number | null | undefined,
    ): string {
      if (stitchesPer10cm == null && rowsPer10cm == null) return '—';

      const isImperial = prefs.gaugeBase === '4in';
      const factor = isImperial ? (4 * CM_PER_IN) / 10 : 1; // scale from 10cm to 4in
      const baseLabel = isImperial ? '4 in' : '10 cm';

      const parts: string[] = [];
      if (stitchesPer10cm != null) {
        const val = (stitchesPer10cm * factor).toFixed(1).replace(/\.0$/, '');
        parts.push(`${val} sts`);
      }
      if (rowsPer10cm != null) {
        const val = (rowsPer10cm * factor).toFixed(1).replace(/\.0$/, '');
        parts.push(`${val} rows`);
      }

      return `${parts.join(' / ')} per ${baseLabel}`;
    },

    /**
     * Format a cable length stored in mm to the user's preferred length unit.
     * Returns e.g. '24"' or '60 cm'.
     */
    cableLength(mm: number | null | undefined): string {
      if (mm == null) return '—';
      if (prefs.lengthUnit === 'mm') return `${Math.round(mm)} mm`;
      if (prefs.lengthUnit === 'cm') return `${Math.round(mm / 10)} cm`;
      // inches
      return `${Math.round(mm / 25.4)}"`;
    },

    /** Convert meters to the user's preferred yarn unit (raw number) */
    metersToPreferred(meters: number): number {
      return prefs.yarnQuantityUnit === 'yd' ? meters * M_TO_YD : meters;
    },

    /** Convert the user's preferred yarn unit back to meters */
    preferredToMeters(value: number): number {
      return prefs.yarnQuantityUnit === 'yd' ? value / M_TO_YD : value;
    },

    /** Current preference values (for building settings UI) */
    prefs,
  };

  return { fmt, prefs };
}
