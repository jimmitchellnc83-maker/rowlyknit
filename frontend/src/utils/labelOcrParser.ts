/**
 * Pure regex-based extraction of yarn-label fields from OCR output.
 *
 * Tesseract's raw text is noisy: skewed baselines, missing diacritics,
 * occasional misreads (0 ↔ O, 1 ↔ I, 5 ↔ S). The parser aims for high
 * precision — it suggests values when confident and leaves them null when
 * not. The user reviews and edits before saving.
 *
 * Fields covered:
 *   - dye lot / dye batch       (the main OCR spec requirement)
 *   - color code / colorway #   (numeric or alphanumeric product code)
 *   - color name                (free text after "color:")
 *   - yarn weight category      (matched against the CYC alias list)
 *
 * Kept pure + framework-free so the test suite can hit every branch
 * without mounting Tesseract.
 */

export interface ParsedYarnLabel {
  dyeLot: string | null;
  colorCode: string | null;
  colorName: string | null;
  weight: string | null;
  /** The raw OCR text with leading/trailing whitespace trimmed. */
  rawText: string;
}

const WEIGHT_ALIASES: Array<{ canonical: string; aliases: string[] }> = [
  { canonical: 'Lace', aliases: ['lace', 'thread', 'cobweb'] },
  { canonical: 'Super Fine', aliases: ['super fine', 'superfine', 'fingering', 'sock'] },
  { canonical: 'Fine', aliases: ['fine', 'sport'] },
  { canonical: 'Light', aliases: ['light', 'dk', 'double knitting'] },
  { canonical: 'Medium', aliases: ['medium', 'worsted', 'afghan', 'aran'] },
  { canonical: 'Bulky', aliases: ['bulky', 'chunky', 'craft'] },
  { canonical: 'Super Bulky', aliases: ['super bulky', 'superbulky', 'roving'] },
  { canonical: 'Jumbo', aliases: ['jumbo'] },
];

export function parseYarnLabel(rawText: string): ParsedYarnLabel {
  const text = (rawText ?? '').trim();
  const result: ParsedYarnLabel = {
    dyeLot: null,
    colorCode: null,
    colorName: null,
    weight: null,
    rawText: text,
  };
  if (!text) return result;

  result.dyeLot = extractDyeLot(text);
  result.colorCode = extractColorCode(text);
  result.colorName = extractColorName(text);
  result.weight = extractWeight(text);

  return result;
}

/**
 * Dye lot is commonly labelled "Lot:", "Dye Lot", "Batch", "Lot #", "DL:".
 * Captured value is alphanumeric, may contain hyphens. Length 3–20 to avoid
 * picking up a full sentence or a stray single character.
 */
function extractDyeLot(text: string): string | null {
  const patterns: RegExp[] = [
    /\bdye\s*lot\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9-]{2,19})/i,
    /\bdye\s*batch\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9-]{2,19})/i,
    /\bbatch\s*[:#]?\s*([A-Za-z0-9][A-Za-z0-9-]{2,19})/i,
    /\bdl\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9-]{2,19})/i,
    /\blot\s*[:#]\s*([A-Za-z0-9][A-Za-z0-9-]{2,19})/i,
    /\blot\s*no\.?\s*([A-Za-z0-9][A-Za-z0-9-]{2,19})/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

/**
 * Color code sits next to labels like "Color:", "Colour:", "Col:", "Shade:",
 * or a standalone "#123" near the color line. Values tend to be 2–8 digits
 * or a letter followed by digits (e.g. "B54", "2450").
 *
 * Ordering matters: the explicit "color code/no." pattern runs before the
 * bare "color: 2450" fallback so it wins when both could match.
 */
function extractColorCode(text: string): string | null {
  const patterns: RegExp[] = [
    /\bcolou?r\s*(?:code|no\.?|#)\s*[:#]?\s*([A-Za-z]?\d{2,6}[A-Za-z]?)\b/i,
    /\bshade\s*[:#]?\s*([A-Za-z]?\d{2,6}[A-Za-z]?)\b/i,
    /\bcol\.?\s*[:#]\s*([A-Za-z]?\d{2,6}[A-Za-z]?)\b/i,
    /\b#(\d{3,6})\b/,
    // "Color: 2450" — value is digit-led, distinguishing it from a name.
    /\bcolou?r\s*[:#]\s*(\d{2,6}[A-Za-z]?)\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) return m[1];
  }
  return null;
}

/**
 * Color name: the free-text word or phrase following "Color:" / "Colour:".
 * Stops at the next line break or a digit (to avoid swallowing the code).
 * The character class uses a literal space rather than `\s` so `\n` ends
 * the match — otherwise greedy matching pulls in the next line.
 * Excludes the word "code" so we don't accidentally return "code" when the
 * label reads "Color code: 2450".
 */
function extractColorName(text: string): string | null {
  const m = text.match(/\bcolou?r\s*[:#]?\s*([A-Za-z][A-Za-z '-]{1,30})(?=\r?\n|\d|$)/i);
  if (!m) return null;
  const raw = m[1].trim();
  if (!raw) return null;
  // Skip results that are just the word "code" (the label, not a value)
  if (/^(code|no|number)$/i.test(raw)) return null;
  return raw;
}

/**
 * Match against the CYC alias list. Prefers the longest alias so
 * "super fine" beats "fine".
 */
function extractWeight(text: string): string | null {
  const lower = text.toLowerCase();
  const flat = WEIGHT_ALIASES.flatMap((w) =>
    w.aliases.map((a) => ({ alias: a, canonical: w.canonical })),
  ).sort((a, b) => b.alias.length - a.alias.length);
  for (const { alias, canonical } of flat) {
    const re = new RegExp(`\\b${alias.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(lower)) return canonical;
  }
  return null;
}
