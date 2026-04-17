// ── Thin re-export bridge ───────────────────────────────────────
// Backward-compatible re-exports from the measurement module.
// New code should import directly from '../measurement'.

export type { NeedleSizeFormat, NeedleSize, CrochetHookSize } from '../measurement/types';
export type { CableLengthEntry as CableLengthSize } from '../measurement/types';

// Re-export data arrays and lookup maps
export {
  KNITTING_NEEDLES,
  CROCHET_HOOKS,
  CABLE_LENGTHS,
  needleByMM,
  hookByMM,
  needleByUS,
  hookByUS,
  lookupNeedleByMM,
  lookupHookByMM,
  getNeedleSizeOptions,
  getCrochetHookOptions,
  parseSizeToMM,
} from '../measurement/reference';

// ── getCableLengthOptions compatibility wrapper ─────────────────
// Old signature: getCableLengthOptions(lengthUnit: 'in' | 'cm')
//   returned { label, value: inches }
// New signature: getCableLengthOptions(unit: LengthDisplayUnit)
//   returns  { label, value: lengthMm }
// Re-export the new version directly (callers that used inches as
// the stored value need updating to mm anyway with the new schema).
export { getCableLengthOptions } from '../measurement/reference';

// ── Legacy format functions ─────────────────────────────────────
// The old file exposed formatNeedleSize / formatHookSize that accept
// (mm, format) directly.

import { needleByMM, hookByMM, needleByUS, hookByUS } from '../measurement/reference';
import type { NeedleSizeFormat } from '../measurement/types';

/** Format a knitting needle size for display given mm value */
export function formatNeedleSize(mm: number | null | undefined, format: NeedleSizeFormat): string {
  if (mm == null) return '\u2014';
  const n = needleByMM.get(mm);
  if (!n) return `${mm}mm`;

  switch (format) {
    case 'metric':
      return n.us ? `${mm}mm (US ${n.us})` : `${mm}mm`;
    case 'us':
      return n.us ? `US ${n.us} (${mm}mm)` : `${mm}mm`;
    case 'uk':
      return n.uk ? `UK ${n.uk} (${mm}mm)` : `${mm}mm`;
  }
}

/** Format a crochet hook size for display given mm value */
export function formatHookSize(mm: number | null | undefined, format: NeedleSizeFormat): string {
  if (mm == null) return '\u2014';
  const h = hookByMM.get(mm);
  if (!h) return `${mm}mm`;

  switch (format) {
    case 'metric':
      return h.us ? `${mm}mm (${h.us})` : `${mm}mm`;
    case 'us':
      return h.us ? `${h.us} (${mm}mm)` : `${mm}mm`;
    case 'uk':
      return h.uk ? `UK ${h.uk} (${mm}mm)` : `${mm}mm`;
  }
}

/** Convert US needle number to mm. Returns null if not found. */
export function usNeedleToMM(us: string): number | null {
  return needleByUS.get(us)?.mm ?? null;
}

/** Convert US hook designation to mm. Returns null if not found. */
export function usHookToMM(us: string): number | null {
  return hookByUS.get(us)?.mm ?? null;
}
