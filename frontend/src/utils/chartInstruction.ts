/**
 * Chart-to-text engine. Walks a ChartData grid + a symbol palette and emits
 * a row-by-row written instruction set the way a knitter would write it
 * (e.g. "Row 1 (RS): k2, [k2tog, yo] 4x, k2").
 *
 * Aware of:
 *   - RS / WS alternation when the chart is worked flat
 *   - "every row is RS" when the chart is worked in the round
 *   - Multi-cell stitches (one operation per leader, not per cell)
 *   - Same-symbol run compression ("k1, k1, k1" → "k3" or "[k2tog] 3 times")
 *   - Whole-row repeat detection ("k2, p2, k2, p2, k2, p2" → "[k2, p2] 3 times")
 *
 * Pure module — takes its inputs as plain objects, returns plain data, no
 * React / axios / DOM. The Designer page passes the palette in from
 * useChartSymbols(); the print view does the same.
 */
import { resolveStitchKey } from '../data/stitchSvgLibrary';
import type { ChartData } from '../components/designer/ChartGrid';
import type { ChartSymbolTemplate } from '../types/chartSymbol';
import type { Craft, Technique } from '../types/pattern';
import {
  buildRowPrefix,
  isRightSideRow,
  shouldReverseCellOrder,
} from './techniqueRules';

export type ChartInstructionMode = 'shape-only' | 'with-chart-ref' | 'with-chart-text';

/** One row's worth of generated instructions. */
export interface ChartRowInstruction {
  /** 1-indexed row number as a knitter reads it (1 = bottom of chart). */
  rowNumber: number;
  /** True for RS rows (always true when worked in the round). */
  isRS: boolean;
  /** True when the chart is worked in the round (every row is a "Round"). */
  isRound: boolean;
  /** "Row N (RS):" / "Row N (WS):" / "Round N:" — ready to render. */
  prefix: string;
  /** Comma-joined operations, e.g. "k2, [k2tog, yo] 4x, k2". */
  body: string;
  /** Stitch count after this row (sum of operation deltas). Useful for
   *  showing "(N sts)" trailing — caller decides whether to render. */
  stitchCount: number;
  /** Empty-row flag — body === "" means the row had no painted cells.
   *  Caller may want to skip these or render them as "Row N: (empty)". */
  isEmpty: boolean;
  /** Issues encountered while generating this row (e.g. an RS-only stitch
   *  appearing on a WS row). One entry per issue. */
  warnings: string[];
}

/** Inputs to {@link buildChartInstructions}. */
export interface BuildChartInstructionsOptions {
  chart: ChartData;
  /** Known symbol templates (system + custom merged). The function looks
   *  each cell symbol up here for abbrev / RS+WS instruction / cell_span. */
  symbols: ChartSymbolTemplate[];
  /** Active craft. Defaults to 'knit' for backward compatibility with
   *  call sites that pre-date the technique-rules engine. */
  craft?: Craft;
  /** Active technique. Defaults to 'standard'; the engine uses the
   *  craft+technique pair to drive RS/WS alternation, cell traversal
   *  direction, and row-prefix vocabulary. */
  technique?: Technique;
}

/**
 * Generate row-by-row written instructions for a chart.
 *
 * Returns one entry per chart row in working order — index 0 = row 1
 * (bottom of chart, the first row a knitter works).
 */
export function buildChartInstructions(
  options: BuildChartInstructionsOptions,
): ChartRowInstruction[] {
  const { chart, symbols } = options;
  const craft: Craft = options.craft ?? 'knit';
  const technique: Technique = options.technique ?? 'standard';
  const inRound = chart.workedInRound === true;

  // Build a fast lookup from canonical symbol → template.
  const bySymbol = new Map<string, ChartSymbolTemplate>();
  for (const t of symbols) bySymbol.set(t.symbol, t);

  const rows: ChartRowInstruction[] = [];

  for (let knitRow = 1; knitRow <= chart.height; knitRow++) {
    // The cells array is row-major with index 0 = TOP of chart visually.
    // Knitter row 1 is at the BOTTOM, so it lives at the LAST row of cells.
    const cellRow = chart.height - knitRow;
    const isRS = isRightSideRow(knitRow, inRound, craft, technique);

    const ops = walkRow(chart, cellRow, isRS, inRound, craft, technique, bySymbol);
    const empty = ops.every((op) => op.kind === 'gap');
    const warnings = ops.flatMap((op) => (op.kind === 'op' ? op.warnings : []));
    const compressed = compressOps(ops);
    const body = formatRowBody(compressed);
    const stitchCount = ops.reduce(
      (acc, op) => (op.kind === 'op' ? acc + op.stitchOut : acc + 1),
      0,
    );

    const prefix = buildRowPrefix(knitRow, inRound, craft, technique);

    rows.push({
      rowNumber: knitRow,
      isRS,
      isRound: inRound,
      prefix,
      body,
      stitchCount,
      isEmpty: empty,
      warnings,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

interface RowOp {
  kind: 'op';
  /** Display abbreviation, e.g. "k", "k2tog", "c4f". */
  abbrev: string;
  /** RS or WS instruction text, e.g. "k1", "p1", "k2tog", "yo". */
  text: string;
  /** Symbol's cell_span (1 for normal stitches, 2+ for cables). */
  cellSpan: number;
  /** How many stitches this op consumes from the previous row (for stitch
   *  counting). For now we don't model deltas precisely — this is just
   *  cellSpan, which equals stitches consumed for most chart symbols. */
  stitchIn: number;
  /** How many stitches this op produces on the new row. Same heuristic. */
  stitchOut: number;
  warnings: string[];
}

interface RowGap {
  kind: 'gap';
  /** Number of contiguous empty cells. */
  span: number;
}

type RowToken = RowOp | RowGap;

function walkRow(
  chart: ChartData,
  cellRow: number,
  isRS: boolean,
  inRound: boolean,
  craft: Craft,
  technique: Technique,
  bySymbol: Map<string, ChartSymbolTemplate>,
): RowToken[] {
  // Cell traversal direction comes from the technique-rules engine —
  // knit standard reverses on RS only; crochet always reverses; rounds
  // always reverse; Tunisian alternates per pass.
  const visualOrder: { cellIndex: number; symbolId: string | null }[] = [];
  for (let c = 0; c < chart.width; c++) {
    const idx = cellRow * chart.width + c;
    visualOrder.push({ cellIndex: idx, symbolId: chart.cells[idx]?.symbolId ?? null });
  }
  const reverse = shouldReverseCellOrder(isRS, inRound, craft, technique);
  const working = reverse ? [...visualOrder].reverse() : visualOrder;

  const tokens: RowToken[] = [];
  let i = 0;
  while (i < working.length) {
    const here = working[i];
    const canonicalHere = here.symbolId ? resolveStitchKey(here.symbolId) ?? here.symbolId : null;
    if (!canonicalHere || canonicalHere === 'no-stitch') {
      // Coalesce contiguous empty / no-stitch cells into one gap token.
      let span = 1;
      while (i + span < working.length) {
        const nx = working[i + span];
        const nxCanonical = nx.symbolId ? resolveStitchKey(nx.symbolId) ?? nx.symbolId : null;
        if (nxCanonical && nxCanonical !== 'no-stitch') break;
        span++;
      }
      tokens.push({ kind: 'gap', span });
      i += span;
      continue;
    }

    const canonical = canonicalHere;
    const template = bySymbol.get(canonical);

    // Run length: number of contiguous cells with the same symbol id.
    let run = 1;
    while (
      i + run < working.length &&
      (resolveStitchKey(working[i + run].symbolId) ?? working[i + run].symbolId) === canonical
    ) {
      run++;
    }

    const span = template?.cell_span ?? 1;
    // For multi-cell stitches the run is normally span * N — emit N ops.
    // For 1-cell stitches, emit `run` ops.
    const opCount = span > 1 ? Math.max(1, Math.floor(run / span)) : run;
    const abbrev = template?.abbreviation ?? canonical;

    let text: string;
    const warnings: string[] = [];
    if (inRound || isRS) {
      text = template?.rs_instruction ?? abbrev;
    } else {
      const ws = template?.ws_instruction ?? null;
      if (ws) {
        text = ws;
      } else {
        // RS-only stitch landed on a WS row. Fall back to the abbrev and
        // surface a warning for the caller to display.
        text = template?.rs_instruction ?? abbrev;
        warnings.push(`${abbrev} on a WS row — typically worked from the right side only`);
      }
    }

    for (let k = 0; k < opCount; k++) {
      tokens.push({
        kind: 'op',
        abbrev,
        text,
        cellSpan: span,
        stitchIn: span,
        stitchOut: span,
        warnings: k === 0 ? warnings : [],
      });
    }
    i += run;
  }
  return tokens;
}

interface CompressedOp {
  /** Display string, e.g. "k3", "[k2tog] 3 times", "(no st)". */
  text: string;
  /** Underlying op for repeat detection. Same op iff same `key`. */
  key: string;
}

/**
 * Run-length encode adjacent same-op tokens and emit human-friendly text.
 * "k1 k1 k1" → "k3" when the abbreviation is bare alphabetic.
 * "k2tog k2tog k2tog" → "[k2tog] 3 times" when the abbreviation contains digits.
 */
function compressOps(tokens: RowToken[]): CompressedOp[] {
  const out: CompressedOp[] = [];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.kind === 'gap') {
      out.push({
        text: tok.span === 1 ? '(no st)' : `(no st) ${tok.span} times`,
        key: `gap:${tok.span}`,
      });
      i++;
      continue;
    }
    let n = 1;
    while (
      i + n < tokens.length &&
      tokens[i + n].kind === 'op' &&
      (tokens[i + n] as RowOp).abbrev === tok.abbrev &&
      (tokens[i + n] as RowOp).text === tok.text
    ) {
      n++;
    }
    out.push({ text: renderRun(tok, n), key: `op:${tok.abbrev}:${tok.text}` });
    i += n;
  }
  return out;
}

function renderRun(op: RowOp, count: number): string {
  if (count === 1) return op.text;
  // Per-stitch ops compress by appending the count to the letters:
  //   "k1" × 5 → "k5"      (knit form, "1" stripped)
  //   "sc"  × 4 → "sc4"    (crochet form, no "1")
  //   "ch 1" × 3 → "ch3"  (chain — ws/rs is "ch 1")
  // Compound ops (digits inside, e.g. k2tog / c4f / dc2tog) are rendered
  // with bracket-times notation since "k2tog3" is not knitter-idiomatic.
  const trim = op.text.match(/^([A-Za-z]+)(?:\s*1)?$/);
  if (trim) {
    return `${trim[1]}${count}`;
  }
  return `[${op.text}] ${count} times`;
}

/**
 * Detect a whole-row repeat — if the compressed list is exactly N copies of
 * the same length-K prefix, fold it into "[<prefix>] N times". Picks the
 * shortest viable K.
 */
function formatRowBody(parts: CompressedOp[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].text;

  for (let k = 1; k <= Math.floor(parts.length / 2); k++) {
    if (parts.length % k !== 0) continue;
    const reps = parts.length / k;
    if (reps < 2) continue;
    let ok = true;
    for (let j = k; j < parts.length && ok; j++) {
      if (parts[j].key !== parts[j % k].key) ok = false;
    }
    if (ok) {
      const prefix = parts.slice(0, k).map((p) => p.text).join(', ');
      return `[${prefix}] ${reps} times`;
    }
  }

  return parts.map((p) => p.text).join(', ');
}

// ---------------------------------------------------------------------------
// Convenience: a default chart-reference label when a chart has no name.
// Session 4 will replace this with persisted chart names.
// ---------------------------------------------------------------------------

export function defaultChartLabel(): string {
  return 'Chart';
}

// ---------------------------------------------------------------------------
// Glossary support — collect the unique used symbol ids from a chart, in
// chart-reading order (left-to-right, bottom-to-top). Used by the print
// view to build a "Glossary" table (Session 2 PR 2.2).
// ---------------------------------------------------------------------------

/**
 * Walks a chart and returns the set of canonical symbol ids actually painted
 * on it, in stable order (first-seen wins). `null` cells and the
 * placeholder `no-stitch` (or its legacy alias `no_stitch`) are excluded —
 * they're not real stitches and shouldn't appear in the glossary.
 *
 * Pure: no React / DOM / network. Caller passes the resulting list to
 * useChartSymbols-loaded templates to render a glossary table.
 */
export function collectChartSymbols(chart: ChartData): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  // Bottom-to-top for ordering matches knitter reading order: the first
  // stitch in the glossary is whatever appears at row 1.
  for (let knitRow = 1; knitRow <= chart.height; knitRow++) {
    const cellRow = chart.height - knitRow;
    for (let c = 0; c < chart.width; c++) {
      const cell = chart.cells[cellRow * chart.width + c];
      if (!cell?.symbolId) continue;
      const canonical = resolveStitchKey(cell.symbolId) ?? cell.symbolId;
      if (canonical === 'no-stitch') continue;
      if (seen.has(canonical)) continue;
      seen.add(canonical);
      order.push(canonical);
    }
  }
  return order;
}

// ---------------------------------------------------------------------------
// Cast-on preamble — when a chart marks a repeat region, the printed
// pattern should lead with the conventional "Cast on a multiple of N sts,
// plus E" formula derived from the repeat width.
// ---------------------------------------------------------------------------

/**
 * Format the cast-on preamble for a chart with a repeat region.
 *
 * Returns null when the chart has no `repeatRegion`, or when the region is
 * malformed (out of bounds / inverted) — callers should treat null as
 * "no preamble" rather than as an error.
 *
 * Examples (assuming chart.width = 22):
 *   - repeat cols 0..21 (full width)   → "Cast on a multiple of 22 sts."
 *   - repeat cols 2..11 (10-st repeat) → "Cast on a multiple of 10 sts, plus 12."
 *   - 1-stitch repeat                  → "Cast on a multiple of 1 st, plus N."
 */
export function formatCastOnFromRepeat(chart: ChartData): string | null {
  const r = chart.repeatRegion;
  if (!r) return null;
  if (r.startCol < 0 || r.endCol >= chart.width || r.startCol > r.endCol) return null;
  const repeatWidth = r.endCol - r.startCol + 1;
  const edgeStitches = chart.width - repeatWidth;
  const stUnit = repeatWidth === 1 ? 'st' : 'sts';
  if (edgeStitches === 0) {
    return `Cast on a multiple of ${repeatWidth} ${stUnit}.`;
  }
  return `Cast on a multiple of ${repeatWidth} ${stUnit}, plus ${edgeStitches}.`;
}
