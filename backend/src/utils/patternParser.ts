/**
 * Pattern text parser for Panel Mode's paste-and-parse flow (spec §4A Path A).
 *
 * Accepts a free-form block of knitting text and emits one or more
 * candidate panels with their rows. The output is ALWAYS editable — this
 * parser does its best and surfaces warnings, never hides them. Confidence
 * scores let the UI highlight rows that were guessed aggressively.
 *
 * No state. No DB. Called from the `/panels/parse` endpoint and can be
 * unit-tested directly.
 */

export interface ParsedPanelRow {
  row_number: number;
  instruction: string;
  confidence: number; // 0..1
}

export interface ParsedPanel {
  suggested_name: string;
  repeat_length: number;
  rows: ParsedPanelRow[];
  warnings: string[];
}

export interface ParseResult {
  panels: ParsedPanel[];
  warnings: string[];
}

/**
 * Normalize curly quotes, em/en-dashes, non-breaking spaces, and collapse
 * internal whitespace before regex matching. Keeps newline structure intact
 * because section boundaries are newline-delimited.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014]/g, '-') // en-dash, em-dash → hyphen
    .replace(/\u00A0/g, ' ') // nbsp
    .replace(/[ \t]+/g, ' ')
    .replace(/\r\n?/g, '\n')
    .trim();
}

// Priority-ordered matchers. Each produces ParsedPanelRow[] or empty.
// Order matters: range/multi must come before single because the single
// regex would match the leading number and drop the rest.

const RE_RANGE = /^(?:Row|Rnd|Round|R)s?\s*(\d+)\s*(?:-|to)\s*(\d+)\s*[:.\-)]\s*(.+)$/i;
const RE_MULTI = /^(?:Row|Rnd|Round|R)s?\s*(\d+(?:\s*(?:,|and|&)\s*\d+)+)\s*[:.\-)]\s*(.+)$/i;
const RE_SINGLE_WORD = /^(?:Row|Rnd|Round|R)\s*(\d+)\s*[:.\-)]\s*(.+)$/i;
const RE_SINGLE_BARE = /^(\d+)\s*[:.)\-]\s*(.+)$/;

interface RawRow {
  row_number: number;
  instruction: string;
  confidence: number;
  explicit: boolean; // true if the source line specified this row_number directly
}

function parseLine(line: string): RawRow[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  // Range: "Rows 1-4: knit"
  const rangeMatch = trimmed.match(RE_RANGE);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    const instruction = rangeMatch[3].trim();
    if (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      start > 0 &&
      end >= start &&
      end - start < 200
    ) {
      const rows: RawRow[] = [];
      for (let n = start; n <= end; n++) {
        rows.push({
          row_number: n,
          instruction,
          confidence: 0.95,
          explicit: true,
        });
      }
      return rows;
    }
  }

  // Multi: "Rows 1 and 3: knit" or "Rows 2, 4, 6: purl"
  const multiMatch = trimmed.match(RE_MULTI);
  if (multiMatch) {
    const numList = multiMatch[1].split(/,|and|&/i).map((s) => s.trim());
    const numbers = numList
      .map((s) => parseInt(s, 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    const instruction = multiMatch[2].trim();
    if (numbers.length >= 2) {
      return numbers.map((n) => ({
        row_number: n,
        instruction,
        confidence: 0.9,
        explicit: true,
      }));
    }
  }

  // Single: "Row 1: K2, P2"
  const singleMatch = trimmed.match(RE_SINGLE_WORD);
  if (singleMatch) {
    const n = parseInt(singleMatch[1], 10);
    if (n > 0) {
      return [
        {
          row_number: n,
          instruction: singleMatch[2].trim(),
          confidence: 1,
          explicit: true,
        },
      ];
    }
  }

  // Bare: "1: K2, P2" or "1) K2"
  const bareMatch = trimmed.match(RE_SINGLE_BARE);
  if (bareMatch) {
    const n = parseInt(bareMatch[1], 10);
    if (n > 0 && n < 500) {
      return [
        {
          row_number: n,
          instruction: bareMatch[2].trim(),
          confidence: 0.85,
          explicit: true,
        },
      ];
    }
  }

  return [];
}

/**
 * Split text into sections at blank-line boundaries. Each section becomes
 * a candidate panel. Single-section text is the common case.
 */
function splitSections(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseSection(section: string, indexHint: number): ParsedPanel | null {
  const lines = section.split('\n');
  const allRows: RawRow[] = [];
  for (const line of lines) {
    allRows.push(...parseLine(line));
  }

  if (allRows.length === 0) return null;

  // Dedupe by row_number — if two lines define the same row, the LAST wins
  // (user probably copied the corrected version on top).
  const byNumber = new Map<number, RawRow>();
  for (const row of allRows) {
    byNumber.set(row.row_number, row);
  }
  const rows = Array.from(byNumber.values()).sort(
    (a, b) => a.row_number - b.row_number,
  );

  const maxRow = Math.max(...rows.map((r) => r.row_number));
  const explicitNumbers = new Set(
    rows.filter((r) => r.explicit).map((r) => r.row_number),
  );
  const warnings: string[] = [];

  // Gap detection: if explicit rows skip numbers (e.g. 1, 3, 5 but not 2, 4),
  // the user probably pasted alternating definitions like "Rows 1 and 3" —
  // we flag and let the UI block the save until gaps are filled.
  const missing: number[] = [];
  for (let n = 1; n <= maxRow; n++) {
    if (!explicitNumbers.has(n)) missing.push(n);
  }
  if (missing.length > 0) {
    warnings.push(
      `Rows ${missing.join(', ')} not in source — fill in before saving.`,
    );
    // Add placeholder rows so the UI has a stable structure to render.
    for (const n of missing) {
      byNumber.set(n, {
        row_number: n,
        instruction: '',
        confidence: 0,
        explicit: false,
      });
    }
  }

  const finalRows = Array.from(byNumber.values()).sort(
    (a, b) => a.row_number - b.row_number,
  );

  return {
    suggested_name: `Panel ${indexHint + 1}`,
    repeat_length: maxRow,
    rows: finalRows.map((r) => ({
      row_number: r.row_number,
      instruction: r.instruction,
      confidence: r.confidence,
    })),
    warnings,
  };
}

export function parsePatternText(input: string): ParseResult {
  const result: ParseResult = { panels: [], warnings: [] };
  if (!input || !input.trim()) {
    result.warnings.push('Empty input.');
    return result;
  }

  const normalized = normalizeText(input);
  const sections = splitSections(normalized);

  sections.forEach((section, i) => {
    const panel = parseSection(section, i);
    if (panel) result.panels.push(panel);
  });

  if (result.panels.length === 0) {
    result.warnings.push(
      'No row definitions detected. Use lines like "Row 1: K2, P2" or "Rnd 1: knit".',
    );
  }

  return result;
}
