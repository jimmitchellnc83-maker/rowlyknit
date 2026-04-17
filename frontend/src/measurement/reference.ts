// ── Reference data tables ───────────────────────────────────────
// Canonical needle, hook, cable, and yarn weight data.
// mm is the source of truth for all tool sizes.

import type {
  NeedleSize,
  CrochetHookSize,
  CableLengthEntry,
  YarnWeightCategory,
  NeedleSizeFormat,
  LengthDisplayUnit,
} from './types';

// ── Knitting needle sizes (1.0mm -- 25.0mm) ────────────────────

export const KNITTING_NEEDLES: NeedleSize[] = [
  { mm: 1.0,   us: '000',   uk: '19' },
  { mm: 1.25,  us: '00',    uk: '18' },
  { mm: 1.5,   us: '1',     uk: '17' },
  { mm: 1.75,  us: '2',     uk: '16' },
  { mm: 2.0,   us: '0',     uk: '14' },
  { mm: 2.25,  us: '1',     uk: '13' },
  { mm: 2.5,   us: '1.5',   uk: null },
  { mm: 2.75,  us: '2',     uk: '12' },
  { mm: 3.0,   us: '2.5',   uk: '11' },
  { mm: 3.25,  us: '3',     uk: '10' },
  { mm: 3.5,   us: '4',     uk: '9' },
  { mm: 3.75,  us: '5',     uk: '8' },
  { mm: 4.0,   us: '6',     uk: '8' },
  { mm: 4.5,   us: '7',     uk: '7' },
  { mm: 5.0,   us: '8',     uk: '6' },
  { mm: 5.5,   us: '9',     uk: '5' },
  { mm: 6.0,   us: '10',    uk: '4' },
  { mm: 6.5,   us: '10.5',  uk: '3' },
  { mm: 7.0,   us: '10.75', uk: '1' },
  { mm: 7.5,   us: null,    uk: '0' },
  { mm: 8.0,   us: '11',    uk: '0' },
  { mm: 9.0,   us: '13',    uk: '00' },
  { mm: 10.0,  us: '15',    uk: '000' },
  { mm: 12.0,  us: '17',    uk: null },
  { mm: 15.0,  us: '19',    uk: null },
  { mm: 19.0,  us: '35',    uk: null },
  { mm: 25.0,  us: '50',    uk: null },
];

// ── Crochet hook sizes (0.6mm -- 19.0mm) ────────────────────────
// Hooks <= 2.1mm are classified as steel (lace/thread work).

export const CROCHET_HOOKS: CrochetHookSize[] = [
  // Steel hooks
  { mm: 0.6,   us: 'Steel 14', uk: null,  letter: null, family: 'steel' },
  { mm: 0.75,  us: 'Steel 12', uk: null,  letter: null, family: 'steel' },
  { mm: 0.85,  us: 'Steel 10', uk: null,  letter: null, family: 'steel' },
  { mm: 0.9,   us: 'Steel 8',  uk: null,  letter: null, family: 'steel' },
  { mm: 1.1,   us: 'Steel 7',  uk: null,  letter: null, family: 'steel' },
  { mm: 1.4,   us: 'Steel 6',  uk: null,  letter: null, family: 'steel' },
  { mm: 1.5,   us: 'Steel 5',  uk: null,  letter: null, family: 'steel' },
  { mm: 1.65,  us: 'Steel 4',  uk: null,  letter: null, family: 'steel' },
  { mm: 1.8,   us: 'Steel 3',  uk: null,  letter: null, family: 'steel' },
  { mm: 1.9,   us: 'Steel 2',  uk: null,  letter: null, family: 'steel' },
  { mm: 2.0,   us: 'Steel 1',  uk: '14',  letter: null, family: 'steel' },
  { mm: 2.1,   us: 'Steel 0',  uk: null,  letter: null, family: 'steel' },
  // Standard hooks
  { mm: 2.25,  us: 'B/1',      uk: '13',  letter: 'B', family: 'standard' },
  { mm: 2.75,  us: 'C/2',      uk: '12',  letter: 'C', family: 'standard' },
  { mm: 3.0,   us: null,        uk: '11',  letter: null, family: 'standard' },
  { mm: 3.25,  us: 'D/3',      uk: '10',  letter: 'D', family: 'standard' },
  { mm: 3.5,   us: 'E/4',      uk: '9',   letter: 'E', family: 'standard' },
  { mm: 3.75,  us: 'F/5',      uk: '8',   letter: 'F', family: 'standard' },
  { mm: 4.0,   us: 'G/6',      uk: '8',   letter: 'G', family: 'standard' },
  { mm: 4.5,   us: '7',         uk: '7',   letter: null, family: 'standard' },
  { mm: 5.0,   us: 'H/8',      uk: '6',   letter: 'H', family: 'standard' },
  { mm: 5.5,   us: 'I/9',      uk: '5',   letter: 'I', family: 'standard' },
  { mm: 6.0,   us: 'J/10',     uk: '4',   letter: 'J', family: 'standard' },
  { mm: 6.5,   us: 'K/10.5',   uk: '3',   letter: 'K', family: 'standard' },
  { mm: 8.0,   us: 'L/11',     uk: '0',   letter: 'L', family: 'standard' },
  { mm: 9.0,   us: 'M/13',     uk: null,  letter: 'M', family: 'standard' },
  { mm: 10.0,  us: 'N/15',     uk: '00',  letter: 'N', family: 'standard' },
  { mm: 11.5,  us: 'P/16',     uk: null,  letter: 'P', family: 'standard' },
  { mm: 15.75, us: 'Q',         uk: null,  letter: 'Q', family: 'standard' },
  { mm: 19.0,  us: 'S',         uk: null,  letter: 'S', family: 'standard' },
];

// ── Circular cable lengths ──────────────────────────────────────
// lengthMm is canonical. inches and cm kept for convenience.

export const CABLE_LENGTHS: CableLengthEntry[] = [
  { lengthMm: 228.6,  inches: 9,  cm: 23 },
  { lengthMm: 304.8,  inches: 12, cm: 30 },
  { lengthMm: 406.4,  inches: 16, cm: 40 },
  { lengthMm: 508.0,  inches: 20, cm: 50 },
  { lengthMm: 609.6,  inches: 24, cm: 60 },
  { lengthMm: 736.6,  inches: 29, cm: 73 },
  { lengthMm: 812.8,  inches: 32, cm: 80 },
  { lengthMm: 914.4,  inches: 36, cm: 90 },
  { lengthMm: 1016.0, inches: 40, cm: 100 },
  { lengthMm: 1193.8, inches: 47, cm: 120 },
  { lengthMm: 1524.0, inches: 60, cm: 150 },
];

// ── Craft Yarn Council weight categories ────────────────────────

export const YARN_WEIGHT_CATEGORIES: YarnWeightCategory[] = [
  {
    number: 0, name: 'Lace',
    aliases: ['lace', 'fingering 10-count', 'thread'],
    wpiMin: 30, wpiMax: 40,
    knitGauge4inMin: 33, knitGauge4inMax: 40,
    crochetGauge4inMin: 32, crochetGauge4inMax: 42,
    needleMmMin: 1.5, needleMmMax: 2.25,
    hookMmMin: 1.5, hookMmMax: 2.25,
    advisoryOnly: false,
  },
  {
    number: 1, name: 'Super Fine',
    aliases: ['super fine', 'fingering', 'sock', 'baby'],
    wpiMin: 14, wpiMax: 30,
    knitGauge4inMin: 27, knitGauge4inMax: 32,
    crochetGauge4inMin: 21, crochetGauge4inMax: 32,
    needleMmMin: 2.25, needleMmMax: 3.25,
    hookMmMin: 2.25, hookMmMax: 3.5,
    advisoryOnly: false,
  },
  {
    number: 2, name: 'Fine',
    aliases: ['fine', 'sport', 'baby'],
    wpiMin: 12, wpiMax: 18,
    knitGauge4inMin: 23, knitGauge4inMax: 26,
    crochetGauge4inMin: 16, crochetGauge4inMax: 20,
    needleMmMin: 3.25, needleMmMax: 3.75,
    hookMmMin: 3.5, hookMmMax: 4.5,
    advisoryOnly: false,
  },
  {
    number: 3, name: 'Light',
    aliases: ['light', 'DK', 'light worsted'],
    wpiMin: 11, wpiMax: 15,
    knitGauge4inMin: 21, knitGauge4inMax: 24,
    crochetGauge4inMin: 12, crochetGauge4inMax: 17,
    needleMmMin: 3.75, needleMmMax: 4.5,
    hookMmMin: 4.5, hookMmMax: 5.5,
    advisoryOnly: false,
  },
  {
    number: 4, name: 'Medium',
    aliases: ['medium', 'worsted', 'afghan', 'aran'],
    wpiMin: 9, wpiMax: 12,
    knitGauge4inMin: 16, knitGauge4inMax: 20,
    crochetGauge4inMin: 11, crochetGauge4inMax: 14,
    needleMmMin: 4.5, needleMmMax: 5.5,
    hookMmMin: 5.5, hookMmMax: 6.5,
    advisoryOnly: false,
  },
  {
    number: 5, name: 'Bulky',
    aliases: ['bulky', 'chunky', 'craft', 'rug'],
    wpiMin: 7, wpiMax: 10,
    knitGauge4inMin: 12, knitGauge4inMax: 15,
    crochetGauge4inMin: 8, crochetGauge4inMax: 11,
    needleMmMin: 5.5, needleMmMax: 8.0,
    hookMmMin: 6.5, hookMmMax: 9.0,
    advisoryOnly: false,
  },
  {
    number: 6, name: 'Super Bulky',
    aliases: ['super bulky', 'roving'],
    wpiMin: 5, wpiMax: 8,
    knitGauge4inMin: 7, knitGauge4inMax: 11,
    crochetGauge4inMin: 5, crochetGauge4inMax: 9,
    needleMmMin: 8.0, needleMmMax: 12.75,
    hookMmMin: 9.0, hookMmMax: 15.0,
    advisoryOnly: false,
  },
  {
    number: 7, name: 'Jumbo',
    aliases: ['jumbo'],
    wpiMin: 1, wpiMax: 6,
    knitGauge4inMin: null, knitGauge4inMax: 6,
    crochetGauge4inMin: null, crochetGauge4inMax: 5,
    needleMmMin: 12.75, needleMmMax: null,
    hookMmMin: 15.0, hookMmMax: null,
    advisoryOnly: false,
  },
];

// ── Lookup maps ─────────────────────────────────────────────────

export const needleByMM = new Map<number, NeedleSize>(
  KNITTING_NEEDLES.map((n) => [n.mm, n]),
);

export const hookByMM = new Map<number, CrochetHookSize>(
  CROCHET_HOOKS.map((h) => [h.mm, h]),
);

export const needleByUS = new Map<string, NeedleSize>();
for (const n of KNITTING_NEEDLES) {
  if (n.us) needleByUS.set(n.us, n);
}

export const hookByUS = new Map<string, CrochetHookSize>();
for (const h of CROCHET_HOOKS) {
  if (h.us) hookByUS.set(h.us, h);
}

// ── Lookup functions ────────────────────────────────────────────

/** Look up a knitting needle entry by its metric (mm) value */
export function lookupNeedleByMM(mm: number): NeedleSize | undefined {
  return needleByMM.get(mm);
}

/** Look up a crochet hook entry by its metric (mm) value */
export function lookupHookByMM(mm: number): CrochetHookSize | undefined {
  return hookByMM.get(mm);
}

/** Get needle size dropdown options formatted for user's preference */
export function getNeedleSizeOptions(
  format: NeedleSizeFormat,
): { label: string; value: number }[] {
  return KNITTING_NEEDLES.map((n) => ({
    label: formatNeedleSizeInternal(n, format),
    value: n.mm,
  }));
}

/** Get crochet hook dropdown options formatted for user's preference */
export function getCrochetHookOptions(
  format: NeedleSizeFormat,
): { label: string; value: number }[] {
  return CROCHET_HOOKS.map((h) => ({
    label: formatHookSizeInternal(h, format),
    value: h.mm,
  }));
}

/** Get cable length dropdown options in user's preferred unit */
export function getCableLengthOptions(
  unit: LengthDisplayUnit,
): { label: string; value: number }[] {
  return CABLE_LENGTHS.map((c) => {
    let label: string;
    switch (unit) {
      case 'mm':
        label = `${c.lengthMm} mm`;
        break;
      case 'cm':
        label = `${c.cm} cm`;
        break;
      case 'in':
      default:
        label = `${c.inches}"`;
        break;
    }
    return { label, value: c.lengthMm };
  });
}

/** Parse a size string (e.g. "US 7 (4.5mm)", "4.5mm", "7") to mm */
export function parseSizeToMM(sizeStr: string): number | null {
  if (!sizeStr) return null;

  // Try extracting mm directly: "4.5mm" or "(4.5mm)"
  const mmMatch = sizeStr.match(/([\d.]+)\s*mm/i);
  if (mmMatch) return parseFloat(mmMatch[1]);

  // Try US number: "US 7" or just "7"
  const usMatch = sizeStr.match(/(?:US\s*)?(\d+(?:\.\d+)?)/i);
  if (usMatch) {
    const usNum = usMatch[1];
    const found = needleByUS.get(usNum) ?? hookByUS.get(usNum);
    if (found) return found.mm;
  }

  // Try US letter: "B/1", "H/8"
  const letterMatch = sizeStr.match(/^([A-Z]\/\d+)/i);
  if (letterMatch) {
    const found = hookByUS.get(letterMatch[1]);
    if (found) return found.mm;
  }

  return null;
}

// ── Internal formatting helpers (used by option builders) ───────

function formatNeedleSizeInternal(n: NeedleSize, format: NeedleSizeFormat): string {
  switch (format) {
    case 'metric':
      return n.us ? `${n.mm}mm (US ${n.us})` : `${n.mm}mm`;
    case 'us':
      return n.us ? `US ${n.us} (${n.mm}mm)` : `${n.mm}mm`;
    case 'uk':
      return n.uk ? `UK ${n.uk} (${n.mm}mm)` : `${n.mm}mm`;
  }
}

function formatHookSizeInternal(h: CrochetHookSize, format: NeedleSizeFormat): string {
  switch (format) {
    case 'metric':
      return h.us ? `${h.mm}mm (${h.us})` : `${h.mm}mm`;
    case 'us':
      return h.us ? `${h.us} (${h.mm}mm)` : `${h.mm}mm`;
    case 'uk':
      return h.uk ? `UK ${h.uk} (${h.mm}mm)` : `${h.mm}mm`;
  }
}
