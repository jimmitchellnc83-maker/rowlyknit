/**
 * Pattern Complexity Service
 *
 * Scores a pattern 1-5 from signals in `notes` (pattern text) + structured
 * fields. Composite of five 0-2 sub-scores: technique variety, row count,
 * piece count, shaping density, size range. Pure functions — no DB access.
 */

export type ComplexityLevel = 1 | 2 | 3 | 4 | 5;

export type ComplexityLabel =
  | 'Beginner'
  | 'Easy'
  | 'Intermediate'
  | 'Advanced'
  | 'Expert';

export interface ComplexityBreakdown {
  techniques: string[];
  techniquePoints: number;
  rowCount: number | null;
  rowCountPoints: number;
  pieceCount: number;
  pieceCountPoints: number;
  shapingCount: number;
  shapingPoints: number;
  sizeCount: number;
  sizePoints: number;
  totalScore: number;
  estimatedHours: number | null;
}

export interface ComplexityResult {
  level: ComplexityLevel;
  label: ComplexityLabel;
  breakdown: ComplexityBreakdown;
}

export interface ComplexityInput {
  notes?: string | null;
  sizes_available?: string | null;
  gauge?: string | null;
}

const LABELS: Record<ComplexityLevel, ComplexityLabel> = {
  1: 'Beginner',
  2: 'Easy',
  3: 'Intermediate',
  4: 'Advanced',
  5: 'Expert',
};

const TECHNIQUE_PATTERNS: Array<{ name: string; regex: RegExp }> = [
  { name: 'cables', regex: /\bcabl(?:e|ing|es|ed)\b|\b(?:C\d+[FB])\b/i },
  { name: 'lace', regex: /\b(?:lace|yarn\s*over|yo\b|ssk|k2tog|p2tog)\b/i },
  { name: 'colorwork', regex: /\b(?:colorwork|fair\s*isle|fairisle|intarsia|stranded|mosaic)\b/i },
  { name: 'brioche', regex: /\b(?:brioche|brk|brp|sl1yo)\b/i },
  { name: 'short-rows', regex: /\b(?:short\s*rows?|w&t|wrap\s*(?:and|&)\s*turn|german\s*short|shadow\s*wrap)\b/i },
  { name: 'slip-stitch', regex: /\b(?:slip\s*stitch|slip\s*st|sl\s*1\s*(?:wyif|wyib|pwise|kwise))\b/i },
  { name: 'double-knit', regex: /\b(?:double\s*knit|double-knit|dk\s*fabric)\b/i },
  { name: 'steek', regex: /\bsteek(?:s|ing|ed)?\b/i },
];

const SECTION_PATTERNS: RegExp[] = [
  /\b(?:front|back|left\s*front|right\s*front|sleeves?|collar|cuffs?|yoke|neckband|neckline|pockets?|edgings?|borders?|crown|hood|brim|thumb|gusset|heel|toe|leg|body)\b[:\n]/gi,
];

const SHAPING_REGEX =
  /\b(?:decreas(?:e|ing)|increas(?:e|ing)|bind\s*off|cast\s*on(?!\s*provisional)|short\s*rows?|raglan|yoke|set-?in|armhole|shape\s*(?:shoulder|neckline|armhole))\b/gi;

export function detectTechniques(text: string): string[] {
  const found = new Set<string>();
  for (const { name, regex } of TECHNIQUE_PATTERNS) {
    if (regex.test(text)) found.add(name);
  }
  return Array.from(found);
}

export function countSections(text: string): number {
  const found = new Set<string>();
  for (const regex of SECTION_PATTERNS) {
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(text)) !== null) {
      found.add(match[0].toLowerCase().replace(/[:\n]/g, '').trim());
    }
  }
  return found.size;
}

export function maxRowNumber(text: string): number | null {
  let max = 0;
  const singleRegex = /\brows?\s*(\d{1,4})\b/gi;
  let m: RegExpExecArray | null;
  while ((m = singleRegex.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > max && n < 10000) max = n;
  }
  const rangeRegex =
    /\brows?\s*\d{1,4}\s*(?:[-–—]+|to|through)\s*(\d{1,4})\b/gi;
  while ((m = rangeRegex.exec(text)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > max && n < 10000) max = n;
  }
  return max || null;
}

export function countShapingInstructions(text: string): number {
  const matches = text.match(SHAPING_REGEX);
  return matches ? matches.length : 0;
}

export function countSizes(sizes?: string | null): number {
  if (!sizes) return 0;
  const parts = sizes
    .split(/[,;/]|\s+(?:to|-|through)\s+|\bor\b/i)
    .map((p) => p.trim())
    .filter(Boolean);
  return parts.length;
}

export function estimateHoursAtReferenceGauge(
  rowCount: number | null,
  gauge?: string | null,
  sizes?: string | null
): number | null {
  if (!rowCount || !gauge) return null;
  const gaugeMatch = gauge.match(/(\d+(?:\.\d+)?)\s*(?:sts?|stitches)/i);
  if (!gaugeMatch) return null;
  const stitchesPer4 = parseFloat(gaugeMatch[1]);
  const per4IsInches = /4\s*(?:in|inch|")/.test(gauge) || !/cm/i.test(gauge);
  const stitchesPerInch = per4IsInches ? stitchesPer4 / 4 : stitchesPer4 / 4 / 2.54;

  const widthInches = sizes ? parseFirstSizeInches(sizes) : null;
  const effectiveWidth = widthInches ?? 20;
  const stitchesPerRow = stitchesPerInch * effectiveWidth;
  const totalStitches = stitchesPerRow * rowCount;
  const REFERENCE_STITCHES_PER_HOUR = 1500;
  return Math.round(totalStitches / REFERENCE_STITCHES_PER_HOUR);
}

function parseFirstSizeInches(sizes: string): number | null {
  const inchMatch = sizes.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches|")/i);
  if (inchMatch) return parseFloat(inchMatch[1]);
  const cmMatch = sizes.match(/(\d+(?:\.\d+)?)\s*cm\b/i);
  if (cmMatch) return parseFloat(cmMatch[1]) / 2.54;
  const bareNumber = sizes.match(/^\s*(\d{2,3})\b/);
  if (bareNumber) {
    const n = parseFloat(bareNumber[1]);
    return n > 60 ? n / 2.54 : n;
  }
  return null;
}

function scoreToLevel(score: number): ComplexityLevel {
  if (score <= 1) return 1;
  if (score <= 3) return 2;
  if (score <= 5) return 3;
  if (score <= 7) return 4;
  return 5;
}

export function calculatePatternComplexity(
  input: ComplexityInput
): ComplexityResult | null {
  const notes = (input.notes ?? '').trim();
  const sizeCount = countSizes(input.sizes_available);
  if (notes.length < 20 && sizeCount === 0) return null;

  const techniques = detectTechniques(notes);
  const techniquePoints =
    techniques.length === 0 ? 0 : techniques.length <= 2 ? 1 : 2;

  const rowCount = maxRowNumber(notes);
  const rowCountPoints =
    rowCount == null ? 0 : rowCount <= 100 ? 0 : rowCount <= 300 ? 1 : 2;

  const pieceCount = countSections(notes);
  const pieceCountPoints =
    pieceCount <= 1 ? 0 : pieceCount <= 3 ? 1 : 2;

  const shapingCount = countShapingInstructions(notes);
  const shapingPoints =
    shapingCount <= 3 ? 0 : shapingCount <= 10 ? 1 : 2;

  const sizePoints = sizeCount <= 1 ? 0 : sizeCount <= 4 ? 1 : 2;

  const totalScore =
    techniquePoints + rowCountPoints + pieceCountPoints + shapingPoints + sizePoints;

  const estimatedHours = estimateHoursAtReferenceGauge(
    rowCount,
    input.gauge,
    input.sizes_available
  );

  const level = scoreToLevel(totalScore);

  return {
    level,
    label: LABELS[level],
    breakdown: {
      techniques,
      techniquePoints,
      rowCount,
      rowCountPoints,
      pieceCount,
      pieceCountPoints,
      shapingCount,
      shapingPoints,
      sizeCount,
      sizePoints,
      totalScore,
      estimatedHours,
    },
  };
}
