// ── Measurement type definitions ────────────────────────────────
// Central source of truth for all measurement-related types.

export type CraftType = 'knitting' | 'crochet';

export type ToolCategory =
  | 'knitting_needle_straight'
  | 'knitting_needle_circular'
  | 'knitting_needle_dpn'
  | 'crochet_hook_standard'
  | 'crochet_hook_steel'
  | 'accessory';

export type HookFamily = 'standard' | 'steel';

export type NeedleSizeFormat = 'metric' | 'us' | 'uk';

export type LengthDisplayUnit = 'mm' | 'cm' | 'in';
export type WeightDisplayUnit = 'g' | 'oz';
export type YarnLengthDisplayUnit = 'm' | 'yd';

export type GaugeDetail = 'per_base' | 'per_unit';
export type GaugeBase = '4in' | '10cm';

// ── Preferences ─────────────────────────────────────────────────

export interface MeasurementPreferences {
  needleSizeFormat: NeedleSizeFormat;
  hookSizeFormat: NeedleSizeFormat;
  gaugeBase: GaugeBase;
  gaugeDetail: GaugeDetail;
  lengthDisplayUnit: LengthDisplayUnit;
  weightDisplayUnit: WeightDisplayUnit;
  yarnLengthDisplayUnit: YarnLengthDisplayUnit;
}

export const DEFAULT_PREFS: MeasurementPreferences = {
  needleSizeFormat: 'us',
  hookSizeFormat: 'us',
  gaugeBase: '4in',
  gaugeDetail: 'per_base',
  lengthDisplayUnit: 'in',
  weightDisplayUnit: 'g',
  yarnLengthDisplayUnit: 'yd',
};

// ── Reference data shapes ───────────────────────────────────────

export interface NeedleSize {
  mm: number;
  us: string | null;
  uk: string | null;
}

export interface CrochetHookSize {
  mm: number;
  us: string | null;
  uk: string | null;
  letter: string | null;
  family: HookFamily;
}

export interface CableLengthEntry {
  lengthMm: number;
  inches: number;
  cm: number;
}

export interface YarnWeightCategory {
  number: number;
  name: string;
  aliases: string[];
  wpiMin: number | null;
  wpiMax: number | null;
  knitGauge4inMin: number | null;
  knitGauge4inMax: number | null;
  crochetGauge4inMin: number | null;
  crochetGauge4inMax: number | null;
  needleMmMin: number | null;
  needleMmMax: number | null;
  hookMmMin: number | null;
  hookMmMax: number | null;
  advisoryOnly: boolean;
}

// ── Settings UI metadata ────────────────────────────────────────

export interface PreferenceOption {
  value: string;
  label: string;
  description: string;
}

export const PREFERENCE_OPTIONS = {
  needleSizeFormat: [
    { value: 'us', label: 'US sizes', description: 'US 7 (4.5mm)' },
    { value: 'metric', label: 'Metric (mm)', description: '4.5mm (US 7)' },
    { value: 'uk', label: 'UK sizes', description: 'UK 7 (4.5mm)' },
  ] as PreferenceOption[],
  hookSizeFormat: [
    { value: 'us', label: 'US sizes', description: 'H/8 (5.0mm)' },
    { value: 'metric', label: 'Metric (mm)', description: '5.0mm (H/8)' },
    { value: 'uk', label: 'UK sizes', description: 'UK 6 (5.0mm)' },
  ] as PreferenceOption[],
  lengthDisplayUnit: [
    { value: 'in', label: 'Inches', description: 'Imperial' },
    { value: 'cm', label: 'Centimeters', description: 'Metric' },
    { value: 'mm', label: 'Millimeters', description: 'Precise metric' },
  ] as PreferenceOption[],
  weightDisplayUnit: [
    { value: 'g', label: 'Grams', description: 'Metric weight' },
    { value: 'oz', label: 'Ounces', description: 'Imperial weight' },
  ] as PreferenceOption[],
  yarnLengthDisplayUnit: [
    { value: 'yd', label: 'Yards', description: 'Imperial' },
    { value: 'm', label: 'Meters', description: 'Metric' },
  ] as PreferenceOption[],
  gaugeBase: [
    { value: '4in', label: '4 inches', description: 'US standard swatch' },
    { value: '10cm', label: '10 cm', description: 'Metric standard swatch' },
  ] as PreferenceOption[],
  gaugeDetail: [
    { value: 'per_base', label: 'Per swatch', description: '20 sts / 4 in' },
    { value: 'per_unit', label: 'Per unit', description: '5 sts/in' },
  ] as PreferenceOption[],
};
