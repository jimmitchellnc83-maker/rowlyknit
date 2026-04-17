// ── Thin re-export bridge ───────────────────────────────────────
// Backward-compatible re-exports from the measurement module.
// New code should import directly from '../measurement'.

import {
  getNeedleSizeOptions,
  getCrochetHookOptions,
  getCableLengthOptions,
} from '../measurement/reference';
import type { NeedleSizeFormat, LengthDisplayUnit } from '../measurement/types';
import type { LengthUnit } from './measurementUnits';

export type SizePreset = 'knitting_needle' | 'crochet_hook' | 'cable_length' | 'none';

/**
 * Returns which size presets are relevant for a given tool type ID.
 */
export function getSizePresetsForType(toolTypeId: string): { primary: SizePreset } {
  switch (toolTypeId) {
    case 'knitting_needles':
    case 'cable_needles':
      return { primary: 'knitting_needle' };
    case 'crochet_hooks':
    case 'tunisian_cords_stoppers':
    case 'ergonomic_hooks_needles':
      return { primary: 'crochet_hook' };
    default:
      return { primary: 'none' };
  }
}

/**
 * Get size options adapted to the user's preferred format.
 * Returns { label, value } where value is mm (number) for needles/hooks
 * and lengthMm for cable lengths.
 */
export function getSizeOptions(
  preset: SizePreset,
  needleFormat: NeedleSizeFormat = 'us',
  lengthUnit: LengthUnit = 'in',
): { label: string; value: number }[] {
  switch (preset) {
    case 'knitting_needle':
      return getNeedleSizeOptions(needleFormat);
    case 'crochet_hook':
      return getCrochetHookOptions(needleFormat);
    case 'cable_length':
      // Map legacy LengthUnit ('in' | 'cm') to LengthDisplayUnit
      return getCableLengthOptions(lengthUnit as LengthDisplayUnit);
    case 'none':
      return [];
  }
}

export function getSizeLabel(
  preset: SizePreset,
  needleFormat: NeedleSizeFormat = 'us',
  lengthUnit: LengthUnit = 'in',
): string {
  switch (preset) {
    case 'knitting_needle':
      return needleFormat === 'metric' ? 'Needle Size (mm)' : needleFormat === 'uk' ? 'Needle Size (UK)' : 'Needle Size (US)';
    case 'crochet_hook':
      return needleFormat === 'metric' ? 'Hook Size (mm)' : needleFormat === 'uk' ? 'Hook Size (UK)' : 'Hook Size';
    case 'cable_length':
      return lengthUnit === 'cm' ? 'Cable Length (cm)' : 'Cable Length';
    case 'none':
      return 'Size';
  }
}
