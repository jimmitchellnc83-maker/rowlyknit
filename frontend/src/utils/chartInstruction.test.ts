import { describe, it, expect } from 'vitest';
import { buildChartInstructions, collectChartSymbols } from './chartInstruction';
import type { ChartData, ChartCell } from '../components/designer/ChartGrid';
import type { ChartSymbolTemplate } from '../types/chartSymbol';

// ---------------------------------------------------------------------------
// Test scaffolding — minimal symbol templates + chart builder helpers.
// ---------------------------------------------------------------------------

function symbol(
  symbol: string,
  abbrev: string,
  rs: string | null,
  ws: string | null,
  cellSpan = 1,
  craft: 'knit' | 'crochet' = 'knit',
): ChartSymbolTemplate {
  return {
    id: symbol,
    symbol,
    name: abbrev.toUpperCase(),
    category: null,
    description: null,
    variations: null,
    is_system: true,
    user_id: null,
    abbreviation: abbrev,
    rs_instruction: rs,
    ws_instruction: ws,
    cell_span: cellSpan,
    craft,
    created_at: '',
  };
}

const KNIT_SYMBOLS: ChartSymbolTemplate[] = [
  symbol('k', 'k', 'k1', 'p1'),
  symbol('p', 'p', 'p1', 'k1'),
  symbol('yo', 'yo', 'yo', 'yo'),
  symbol('k2tog', 'k2tog', 'k2tog', null),
  symbol('ssk', 'ssk', 'ssk', null),
  symbol('c4f', 'c4f', 'c4f', null, 4),
];

const CROCHET_SYMBOLS: ChartSymbolTemplate[] = [
  symbol('sc', 'sc', 'sc', 'sc', 1, 'crochet'),
  symbol('dc', 'dc', 'dc', 'dc', 1, 'crochet'),
];

/** Make a chart from an array of rows, each row a list of symbol-id strings
 *  (or `null` for blank). Row 0 of the input is the TOP of the chart
 *  (matches the cells-array layout). */
function chartOf(rows: (string | null)[][], opts: Partial<ChartData> = {}): ChartData {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const cells: ChartCell[] = [];
  for (const row of rows) {
    if (row.length !== width) throw new Error('uneven chart rows in test fixture');
    for (const sym of row) cells.push({ symbolId: sym, colorHex: null });
  }
  return { width, height, cells, ...opts };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildChartInstructions', () => {
  it('emits one entry per row, numbered bottom-up (row 1 = bottom)', () => {
    // Top-of-array = top-of-chart. Knitter row 1 = the LAST array row.
    const chart = chartOf([
      ['p', 'p', 'p', 'p'], // visual top → knitter row 2 (WS)
      ['k', 'k', 'k', 'k'], // visual bottom → knitter row 1 (RS)
    ]);
    const out = buildChartInstructions({ chart, symbols: KNIT_SYMBOLS });
    expect(out).toHaveLength(2);
    expect(out[0].rowNumber).toBe(1);
    expect(out[1].rowNumber).toBe(2);
    expect(out[0].isRS).toBe(true);
    expect(out[1].isRS).toBe(false);
  });

  it('compresses a run of plain knits into "k4"', () => {
    const chart = chartOf([['k', 'k', 'k', 'k']]);
    const out = buildChartInstructions({ chart, symbols: KNIT_SYMBOLS });
    expect(out[0].body).toBe('k4');
    expect(out[0].prefix).toBe('Row 1 (RS):');
  });

  it('emits compound stitches with bracket-times notation', () => {
    const chart = chartOf([['k2tog', 'k2tog', 'k2tog']]);
    const out = buildChartInstructions({ chart, symbols: KNIT_SYMBOLS });
    expect(out[0].body).toBe('[k2tog] 3 times');
  });

  it('reads RS rows right-to-left and WS rows left-to-right', () => {
    // RS row: visual is "p k k k k k". Read right-to-left → 5 knits then a
    // purl. Compresses to "k5, p1".
    const chart = chartOf([['p', 'k', 'k', 'k', 'k', 'k']]);
    const rs = buildChartInstructions({ chart, symbols: KNIT_SYMBOLS });
    expect(rs[0].body).toBe('k5, p1');
    expect(rs[0].isRS).toBe(true);

    // Now make it 2 rows so row 2 is WS. The new top row reads visually as
    // "p p p p p k". On a WS row, knit visual = purl worked. Reading
    // left-to-right → 5 ks (from purl visuals → "p1" inverted to "k1") +
    // 1 p (knit visual → ws_instruction "p1").
    // Wait — convention: ws_instruction inverts. The seed maps k.ws='p1'
    // and p.ws='k1'. So:
    //   visual "p" (purl) on WS → ws_instruction of "p" = "k1"
    //   visual "k" (knit) on WS → ws_instruction of "k" = "p1"
    // Row 2 left-to-right: p p p p p k → k1 k1 k1 k1 k1 p1 → "k5, p1".
    const flat = chartOf([
      ['p', 'p', 'p', 'p', 'p', 'k'],
      ['k', 'k', 'k', 'k', 'k', 'k'],
    ]);
    const both = buildChartInstructions({ chart: flat, symbols: KNIT_SYMBOLS });
    expect(both[1].isRS).toBe(false);
    expect(both[1].body).toBe('k5, p1');
  });

  it('detects whole-row 2x2 ribbing repeat', () => {
    // Visual row: "k k p p k k p p k k p p". RS read right-to-left:
    // p p k k p p k k p p k k → "[p2, k2] 3 times".
    const chart = chartOf([['k', 'k', 'p', 'p', 'k', 'k', 'p', 'p', 'k', 'k', 'p', 'p']]);
    const out = buildChartInstructions({ chart, symbols: KNIT_SYMBOLS });
    expect(out[0].body).toBe('[p2, k2] 3 times');
  });

  it('handles cables / multi-cell stitches as one operation per leader span', () => {
    // 4 cells of c4f painted across = 1 cable cross.
    const chart = chartOf([['c4f', 'c4f', 'c4f', 'c4f']]);
    const out = buildChartInstructions({ chart, symbols: KNIT_SYMBOLS });
    expect(out[0].body).toBe('c4f');

    // 8 cells of c4f painted across = 2 back-to-back cable crosses.
    const chart2 = chartOf([['c4f', 'c4f', 'c4f', 'c4f', 'c4f', 'c4f', 'c4f', 'c4f']]);
    const out2 = buildChartInstructions({ chart: chart2, symbols: KNIT_SYMBOLS });
    expect(out2[0].body).toBe('[c4f] 2 times');
  });

  it('treats every row as RS when worked in the round', () => {
    const chart = chartOf(
      [
        ['k', 'k', 'k'],
        ['k', 'k', 'k'],
      ],
      { workedInRound: true },
    );
    const out = buildChartInstructions({ chart, symbols: KNIT_SYMBOLS });
    expect(out[0].isRS).toBe(true);
    expect(out[1].isRS).toBe(true);
    expect(out[0].prefix).toBe('Round 1:');
    expect(out[1].prefix).toBe('Round 2:');
    expect(out[0].body).toBe('k3');
  });

  it('emits a (no st) gap for blank cells inside a row', () => {
    const chart = chartOf([['k', null, null, 'k']]);
    const out = buildChartInstructions({ chart, symbols: KNIT_SYMBOLS });
    // Visual: k _ _ k. RS reads right-to-left: k, _, _, k.
    // Compressed: "k1, (no st) 2 times, k1". Whole-row repeat detection
    // sees parts ["k1", "(no st) 2 times", "k1"] — those keys are
    // ["op:k:k1", "gap:2", "op:k:k1"] — no clean repeat (length 3, no
    // divisor ≥ 2), so the join wins.
    expect(out[0].body).toBe('k1, (no st) 2 times, k1');
  });

  it('marks a row empty when it has no painted cells', () => {
    const chart = chartOf([
      [null, null, null],
      ['k', 'k', 'k'],
    ]);
    const out = buildChartInstructions({ chart, symbols: KNIT_SYMBOLS });
    expect(out[1].isEmpty).toBe(true);
  });

  it('warns when an RS-only stitch (k2tog) lands on a WS row', () => {
    const chart = chartOf([
      ['k2tog', 'k', 'k'], // top → knitter row 2 (WS, RS-only stitch is wrong here)
      ['k', 'k', 'k'],
    ]);
    const out = buildChartInstructions({ chart, symbols: KNIT_SYMBOLS });
    expect(out[1].warnings.length).toBeGreaterThan(0);
    expect(out[1].warnings[0]).toContain('k2tog');
  });

  it('handles legacy frontend symbol ids (knit/purl) via resolveStitchKey', () => {
    const chart = chartOf([['knit', 'knit', 'purl', 'purl']]);
    const out = buildChartInstructions({ chart, symbols: KNIT_SYMBOLS });
    // RS reads right-to-left: purl, purl, knit, knit → "p2, k2".
    expect(out[0].body).toBe('p2, k2');
  });

  it('uses crochet templates when chart symbols are crochet ids', () => {
    const chart = chartOf([['sc', 'sc', 'sc', 'sc']]);
    const out = buildChartInstructions({ chart, symbols: CROCHET_SYMBOLS });
    expect(out[0].body).toBe('sc4');
  });

  it('falls back to the symbol id when a template is missing', () => {
    // A chart referencing a symbol not in the palette (e.g. user-custom not
    // loaded) should still render — emit the bare symbol id as the abbrev.
    const chart = chartOf([['mystery']]);
    const out = buildChartInstructions({ chart, symbols: KNIT_SYMBOLS });
    expect(out[0].body).toBe('mystery');
  });

  it('treats no-stitch / legacy no_stitch cells as gaps, not as ops', () => {
    const chart = chartOf([['k', 'no-stitch', 'no_stitch', 'k']]);
    const out = buildChartInstructions({ chart, symbols: KNIT_SYMBOLS });
    // RS reads right-to-left: k, _, _, k → "k1, (no st) 2 times, k1"
    expect(out[0].body).toBe('k1, (no st) 2 times, k1');
  });
});

describe('collectChartSymbols', () => {
  it('returns unique symbols in bottom-up reading order', () => {
    // Top-of-array = top-of-chart. Knitter row 1 = the LAST array row.
    const chart = chartOf([
      ['p', 'p'], // row 2
      ['k', 'p'], // row 1 — first read
    ]);
    expect(collectChartSymbols(chart)).toEqual(['k', 'p']);
  });

  it('skips blanks and no-stitch placeholders', () => {
    const chart = chartOf([['k', null, 'no-stitch', 'no_stitch', 'p']]);
    expect(collectChartSymbols(chart)).toEqual(['k', 'p']);
  });

  it('resolves legacy ids to their canonical key', () => {
    const chart = chartOf([['knit', 'purl', 'yarn_over']]);
    expect(collectChartSymbols(chart)).toEqual(['k', 'p', 'yo']);
  });

  it('returns an empty list for a fully blank chart', () => {
    const chart = chartOf([
      [null, null],
      [null, null],
    ]);
    expect(collectChartSymbols(chart)).toEqual([]);
  });

  it('dedupes when the same symbol appears across multiple rows', () => {
    const chart = chartOf([
      ['k', 'k', 'k'],
      ['k', 'k', 'k'],
    ]);
    expect(collectChartSymbols(chart)).toEqual(['k']);
  });
});
