/**
 * Tests for the repeat expansion engine — PR 3 of the Designer rebuild.
 *
 * Coverage strategy: one suite per repeat form (horizontal, vertical,
 * nested, mirrored, motif, between-markers, panel) plus targeted tests
 * for source attribution and warnings. Each suite uses tiny hand-rolled
 * fixtures so failures point at the offending case directly.
 */

import { describe, it, expect } from 'vitest';
import { buildMirrorMap, expandSection } from '../repeatEngine';
import type {
  HorizontalRepeatToken,
  LiteralStitchToken,
  RepeatBlock,
  RowSpec,
  SectionRowSequence,
} from '../../types/repeat';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const k = (cellSpan = 1): LiteralStitchToken => ({ kind: 'stitch', symbolId: 'k', cellSpan });
const p = (cellSpan = 1): LiteralStitchToken => ({ kind: 'stitch', symbolId: 'p', cellSpan });
const yo = (): LiteralStitchToken => ({ kind: 'stitch', symbolId: 'yo' });
const k2tog = (): LiteralStitchToken => ({ kind: 'stitch', symbolId: 'k2tog' });

const row = (id: string, ...tokens: RowSpec['tokens']): RowSpec => ({
  id,
  tokens: [...tokens],
});

const literalRow = (r: RowSpec): SectionRowSequence['items'][0] => ({
  kind: 'literal',
  row: r,
});

const repeatRow = (block: RepeatBlock): SectionRowSequence['items'][0] => ({
  kind: 'repeat',
  block,
});

// ---------------------------------------------------------------------------
// 1. Horizontal repeats (within-row)
// ---------------------------------------------------------------------------

describe('expandSection — horizontal repeats', () => {
  it('unrolls "[k2tog, yo] 4 times" into 8 stitches', () => {
    const horizontal: HorizontalRepeatToken = {
      kind: 'horizontal-repeat',
      id: 'h1',
      body: [k2tog(), yo()],
      count: 4,
    };
    const result = expandSection({
      items: [literalRow({ id: 'r1', tokens: [horizontal] })],
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].tokens).toHaveLength(8);
    expect(result.rows[0].tokens.map((t) => t.symbolId)).toEqual([
      'k2tog', 'yo', 'k2tog', 'yo', 'k2tog', 'yo', 'k2tog', 'yo',
    ]);
  });

  it('attributes each expanded token to its source horizontal repeat + iteration', () => {
    const result = expandSection({
      items: [
        literalRow({
          id: 'r1',
          tokens: [
            { kind: 'horizontal-repeat', id: 'pat', body: [k2tog()], count: 3 },
          ],
        }),
      ],
    });
    const sources = result.rows[0].tokens.map((t) => t.source);
    expect(sources).toEqual([
      { blockId: 'pat', iteration: 1 },
      { blockId: 'pat', iteration: 2 },
      { blockId: 'pat', iteration: 3 },
    ]);
  });

  it('supports horizontal repeats inside horizontal repeats (nested)', () => {
    const result = expandSection({
      items: [
        literalRow({
          id: 'r1',
          tokens: [
            {
              kind: 'horizontal-repeat',
              id: 'outer',
              body: [
                k(),
                {
                  kind: 'horizontal-repeat',
                  id: 'inner',
                  body: [yo()],
                  count: 2,
                },
              ],
              count: 2,
            },
          ],
        }),
      ],
    });
    // 2 outer × (1 k + 2 yo) = 2 * 3 = 6 tokens
    expect(result.rows[0].tokens.map((t) => t.symbolId)).toEqual([
      'k', 'yo', 'yo', 'k', 'yo', 'yo',
    ]);
    // The inner tokens carry the inner block's id, not the outer.
    const yoSources = result.rows[0].tokens
      .filter((t) => t.symbolId === 'yo')
      .map((t) => t.source?.blockId);
    expect(yoSources).toEqual(['inner', 'inner', 'inner', 'inner']);
  });

  it('warns and skips horizontal repeats with count <= 0', () => {
    const result = expandSection({
      items: [
        literalRow({
          id: 'r1',
          tokens: [{ kind: 'horizontal-repeat', id: 'h', body: [k()], count: 0 }],
        }),
      ],
    });
    expect(result.rows[0].tokens).toEqual([]);
    expect(result.warnings.some((w) => w.includes('count is 0'))).toBe(true);
  });

  it('preserves literal tokens around a horizontal repeat', () => {
    const result = expandSection({
      items: [
        literalRow({
          id: 'r1',
          tokens: [
            k(),
            { kind: 'horizontal-repeat', id: 'h', body: [p()], count: 3 },
            k(),
          ],
        }),
      ],
    });
    expect(result.rows[0].tokens.map((t) => t.symbolId)).toEqual([
      'k', 'p', 'p', 'p', 'k',
    ]);
    // Literal tokens have null source (not part of any repeat).
    expect(result.rows[0].tokens[0].source).toBeNull();
    expect(result.rows[0].tokens[4].source).toBeNull();
    expect(result.rows[0].tokens[2].source).toEqual({ blockId: 'h', iteration: 2 });
  });
});

// ---------------------------------------------------------------------------
// 2. Vertical repeats (multi-row)
// ---------------------------------------------------------------------------

describe('expandSection — vertical repeats', () => {
  it('stacks the body N times in row-number order', () => {
    const result = expandSection({
      items: [
        repeatRow({
          kind: 'vertical',
          id: 'v',
          body: [row('a', k()), row('b', p())],
          count: 3,
        }),
      ],
    });
    expect(result.rows).toHaveLength(6);
    expect(result.rows.map((r) => r.tokens[0].symbolId)).toEqual([
      'k', 'p', 'k', 'p', 'k', 'p',
    ]);
    expect(result.rows.map((r) => r.rowNumber)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('attributes each row to its iteration + position-in-body', () => {
    const result = expandSection({
      items: [
        repeatRow({
          kind: 'vertical',
          id: 'v',
          body: [row('a', k()), row('b', p())],
          count: 2,
        }),
      ],
    });
    const sources = result.rows.map((r) => r.source);
    expect(sources).toEqual([
      { blockId: 'v', iteration: 1, positionInBody: 1, rowId: 'a' },
      { blockId: 'v', iteration: 1, positionInBody: 2, rowId: 'b' },
      { blockId: 'v', iteration: 2, positionInBody: 1, rowId: 'a' },
      { blockId: 'v', iteration: 2, positionInBody: 2, rowId: 'b' },
    ]);
  });

  it('mixes literal rows around a vertical repeat correctly', () => {
    const result = expandSection({
      items: [
        literalRow(row('setup', k(), k())),
        repeatRow({
          kind: 'vertical',
          id: 'v',
          body: [row('p', p())],
          count: 3,
        }),
        literalRow(row('finish', k(), k())),
      ],
    });
    expect(result.rows).toHaveLength(5);
    expect(result.rows[0].source).toEqual({
      blockId: null, iteration: 1, positionInBody: 1, rowId: 'setup',
    });
    expect(result.rows[1].source).toEqual({
      blockId: 'v', iteration: 1, positionInBody: 1, rowId: 'p',
    });
    expect(result.rows[4].source.rowId).toBe('finish');
  });

  it('warns and skips vertical repeats with empty body', () => {
    const result = expandSection({
      items: [
        repeatRow({ kind: 'vertical', id: 'v', body: [], count: 5 }),
      ],
    });
    expect(result.rows).toEqual([]);
    expect(result.warnings.some((w) => w.includes('empty body'))).toBe(true);
  });

  it('warns and skips vertical repeats with count <= 0', () => {
    const result = expandSection({
      items: [
        repeatRow({ kind: 'vertical', id: 'v', body: [row('a', k())], count: 0 }),
      ],
    });
    expect(result.rows).toEqual([]);
    expect(result.warnings.some((w) => w.includes('count is 0'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Nested repeats
// ---------------------------------------------------------------------------

describe('expandSection — nested repeats', () => {
  it('nests an outer count around an inner vertical repeat', () => {
    const result = expandSection({
      items: [
        repeatRow({
          kind: 'nested',
          id: 'outer',
          outerCount: 2,
          inner: {
            kind: 'vertical',
            id: 'inner',
            body: [row('a', k()), row('b', p())],
            count: 3,
          },
        }),
      ],
    });
    // 2 outer × (3 vertical × 2 rows) = 12 rows
    expect(result.rows).toHaveLength(12);
    // Source attribution carries the OUTER block id with iteration =
    // outer index, not the inner.
    expect(result.rows[0].source.blockId).toBe('outer');
    expect(result.rows[0].source.iteration).toBe(1);
    expect(result.rows[7].source.iteration).toBe(2);
  });

  it('warns when outerCount <= 0', () => {
    const result = expandSection({
      items: [
        repeatRow({
          kind: 'nested',
          id: 'n',
          outerCount: 0,
          inner: { kind: 'vertical', id: 'v', body: [row('a', k())], count: 1 },
        }),
      ],
    });
    expect(result.rows).toEqual([]);
    expect(result.warnings.some((w) => w.includes('outerCount is 0'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 4. Mirrored repeats
// ---------------------------------------------------------------------------

describe('expandSection — mirrored', () => {
  it('emits the body forward then in reverse order (vertical)', () => {
    const result = expandSection({
      items: [
        repeatRow({
          kind: 'mirrored',
          id: 'm',
          body: [row('a', k()), row('b', p()), row('c', yo())],
        }),
      ],
    });
    expect(result.rows).toHaveLength(6);
    expect(result.rows.map((r) => r.tokens[0].symbolId)).toEqual([
      'k', 'p', 'yo', 'yo', 'p', 'k',
    ]);
    // Forward pass = iteration 1; mirror pass = iteration 2.
    expect(result.rows.map((r) => r.source.iteration)).toEqual([1, 1, 1, 2, 2, 2]);
  });

  it('reverses within-row tokens for mirror tokens', () => {
    const result = expandSection({
      items: [
        literalRow({
          id: 'r1',
          tokens: [
            { kind: 'mirrored', id: 'mr', body: [k(), p(), yo()] },
          ],
        }),
      ],
    });
    expect(result.rows[0].tokens.map((t) => t.symbolId)).toEqual([
      'k', 'p', 'yo', 'yo', 'p', 'k',
    ]);
  });

  it('appends "(mirror)" to the row label on the mirror pass', () => {
    const result = expandSection({
      items: [
        repeatRow({
          kind: 'mirrored',
          id: 'm',
          body: [{ id: 'a', label: 'Setup', tokens: [k()] }],
        }),
      ],
    });
    expect(result.rows[0].label).toBe('Setup');
    expect(result.rows[1].label).toBe('Setup (mirror)');
  });

  // -------------------------------------------------------------------
  // Mirror map (migration #064: chart_symbol_templates.mirror_symbol)
  // -------------------------------------------------------------------
  it('swaps paired symbols on a vertical mirror pass when given a map', () => {
    const result = expandSection(
      {
        items: [
          repeatRow({
            kind: 'mirrored',
            id: 'm',
            body: [{ id: 'r', tokens: [k(), k2tog(), yo()] }],
          }),
        ],
      },
      { k2tog: 'ssk' },
    );
    // Forward row: k, k2tog, yo. Mirror row reverses tokens AND swaps
    // k2tog → ssk, yielding: yo, ssk, k.
    expect(result.rows[1].tokens.map((t) => t.symbolId)).toEqual(['yo', 'ssk', 'k']);
  });

  it('swaps paired symbols on a within-row mirror token', () => {
    const result = expandSection(
      {
        items: [
          literalRow({
            id: 'r1',
            tokens: [
              { kind: 'mirrored', id: 'mr', body: [k(), k2tog(), yo()] },
            ],
          }),
        ],
      },
      { k2tog: 'ssk' },
    );
    // Forward + mirror concat: k, k2tog, yo, yo, ssk, k.
    expect(result.rows[0].tokens.map((t) => t.symbolId)).toEqual([
      'k', 'k2tog', 'yo', 'yo', 'ssk', 'k',
    ]);
  });

  it('falls back to structural mirror (no swap) when no map is given', () => {
    const result = expandSection({
      items: [
        repeatRow({
          kind: 'mirrored',
          id: 'm',
          body: [{ id: 'r', tokens: [k(), k2tog(), yo()] }],
        }),
      ],
    });
    // Mirror row reverses but k2tog stays k2tog (PR 3 behavior).
    expect(result.rows[1].tokens.map((t) => t.symbolId)).toEqual(['yo', 'k2tog', 'k']);
  });

  it('leaves unmapped symbols alone on the mirror pass', () => {
    const result = expandSection(
      {
        items: [
          repeatRow({
            kind: 'mirrored',
            id: 'm',
            body: [{ id: 'r', tokens: [k(), p(), k2tog()] }],
          }),
        ],
      },
      { k2tog: 'ssk' },
    );
    // Mirror row: k2tog→ssk; p (no mapping) stays p; k (no mapping) stays k.
    expect(result.rows[1].tokens.map((t) => t.symbolId)).toEqual(['ssk', 'p', 'k']);
  });

  it('mirror swap walks into nested horizontal repeats', () => {
    // Vertical mirror wrapping a horizontal repeat that contains k2tog:
    // forward emits [k2tog, k2tog]; mirror should emit [ssk, ssk].
    const result = expandSection(
      {
        items: [
          repeatRow({
            kind: 'mirrored',
            id: 'm',
            body: [
              {
                id: 'r',
                tokens: [
                  {
                    kind: 'horizontal-repeat',
                    body: [k2tog()],
                    count: 2,
                  },
                ],
              },
            ],
          }),
        ],
      },
      { k2tog: 'ssk' },
    );
    expect(result.rows[1].tokens.map((t) => t.symbolId)).toEqual(['ssk', 'ssk']);
  });
});

// ---------------------------------------------------------------------------
// buildMirrorMap helper
// ---------------------------------------------------------------------------

describe('buildMirrorMap', () => {
  it('builds an entry for each symbol with a mirror_symbol', () => {
    const map = buildMirrorMap([
      { symbol: 'k2tog', mirror_symbol: 'ssk' },
      { symbol: 'ssk', mirror_symbol: 'k2tog' },
      { symbol: 'k', mirror_symbol: null },
      { symbol: 'p' }, // mirror_symbol omitted entirely
    ]);
    expect(map).toEqual({ k2tog: 'ssk', ssk: 'k2tog' });
  });

  it('returns an empty object when no symbols have mirrors', () => {
    expect(buildMirrorMap([{ symbol: 'k' }])).toEqual({});
    expect(buildMirrorMap([])).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 5. Motif (2D tile)
// ---------------------------------------------------------------------------

describe('expandSection — motif', () => {
  it('tiles a 2x2 motif into countH × countV rows', () => {
    const result = expandSection({
      items: [
        repeatRow({
          kind: 'motif',
          id: 'm',
          body: [row('m1', k(), p()), row('m2', p(), k())],
          countHorizontal: 3,
          countVertical: 2,
        }),
      ],
    });
    // 2 vertical × 2 body rows = 4 expanded rows
    expect(result.rows).toHaveLength(4);
    // Each row tiles the body 3 times across.
    for (const r of result.rows) {
      expect(r.tokens).toHaveLength(2 * 3);
    }
    // Row 1 = motif row 1 tiled 3x
    expect(result.rows[0].tokens.map((t) => t.symbolId)).toEqual([
      'k', 'p', 'k', 'p', 'k', 'p',
    ]);
    // Row 2 = motif row 2 tiled 3x
    expect(result.rows[1].tokens.map((t) => t.symbolId)).toEqual([
      'p', 'k', 'p', 'k', 'p', 'k',
    ]);
  });

  it('attributes motif rows with iteration = vertical index', () => {
    const result = expandSection({
      items: [
        repeatRow({
          kind: 'motif',
          id: 'm',
          body: [row('m1', k())],
          countHorizontal: 2,
          countVertical: 3,
        }),
      ],
    });
    expect(result.rows.map((r) => r.source.iteration)).toEqual([1, 2, 3]);
  });

  it('warns when either count is zero', () => {
    const a = expandSection({
      items: [
        repeatRow({
          kind: 'motif', id: 'm',
          body: [row('m1', k())],
          countHorizontal: 0, countVertical: 2,
        }),
      ],
    });
    expect(a.rows).toEqual([]);
    expect(a.warnings.some((w) => w.includes('zero count'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. Between-markers
// ---------------------------------------------------------------------------

describe('expandSection — between-markers', () => {
  it('derives the iteration count from marker positions', () => {
    const result = expandSection({
      items: [
        literalRow({
          id: 'r1',
          tokens: [
            {
              kind: 'between-markers',
              id: 'bm',
              body: [k2tog(), yo()],
              fromMarker: 'm-start',
              toMarker: 'm-end',
            },
          ],
        }),
      ],
      markersByRow: {
        r1: { 'm-start': 5, 'm-end': 13 }, // span = 8, body width = 2 → 4 iterations
      },
    });
    expect(result.rows[0].tokens.map((t) => t.symbolId)).toEqual([
      'k2tog', 'yo', 'k2tog', 'yo', 'k2tog', 'yo', 'k2tog', 'yo',
    ]);
  });

  it('warns and skips when the marker map is missing for the row', () => {
    const result = expandSection({
      items: [
        literalRow({
          id: 'r1',
          tokens: [
            {
              kind: 'between-markers', id: 'bm',
              body: [k()],
              fromMarker: 'm1', toMarker: 'm2',
            },
          ],
        }),
      ],
    });
    expect(result.rows[0].tokens).toEqual([]);
    expect(result.warnings.some((w) => w.includes('no marker map'))).toBe(true);
  });

  it('warns and skips when one of the markers is unknown', () => {
    const result = expandSection({
      items: [
        literalRow({
          id: 'r1',
          tokens: [
            {
              kind: 'between-markers', id: 'bm',
              body: [k()],
              fromMarker: 'a', toMarker: 'b',
            },
          ],
        }),
      ],
      markersByRow: { r1: { a: 1 } }, // b missing
    });
    expect(result.rows[0].tokens).toEqual([]);
    expect(result.warnings.some((w) => w.includes('not found'))).toBe(true);
  });

  it('warns when marker span is smaller than the body width', () => {
    const result = expandSection({
      items: [
        literalRow({
          id: 'r1',
          tokens: [
            {
              kind: 'between-markers', id: 'bm',
              body: [k(), p(), k()], // body width = 3
              fromMarker: 'a', toMarker: 'b',
            },
          ],
        }),
      ],
      markersByRow: { r1: { a: 1, b: 3 } }, // span = 2 < 3
    });
    expect(result.rows[0].tokens).toEqual([]);
    expect(result.warnings.some((w) => w.includes('smaller than body width'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 7. Panel
// ---------------------------------------------------------------------------

describe('expandSection — panel', () => {
  it('expands LCM rows when no override is given', () => {
    const result = expandSection({
      items: [
        repeatRow({
          kind: 'panel',
          id: 'p',
          panels: [
            {
              id: 'left',
              width: 4,
              body: [row('l1', k()), row('l2', p())], // length 2
            },
            {
              id: 'right',
              width: 6,
              body: [row('r1', k()), row('r2', k()), row('r3', p())], // length 3
            },
          ],
        }),
      ],
    });
    // LCM(2, 3) = 6
    expect(result.rows).toHaveLength(6);
  });

  it('respects an explicit row override', () => {
    const result = expandSection({
      items: [
        repeatRow({
          kind: 'panel',
          id: 'p',
          rows: 4,
          panels: [
            {
              id: 'a', width: 2,
              body: [row('a1', k())],
            },
          ],
        }),
      ],
    });
    expect(result.rows).toHaveLength(4);
  });

  it('emits per-panel slices with correct iteration + positionInBody', () => {
    const result = expandSection({
      items: [
        repeatRow({
          kind: 'panel', id: 'p', rows: 5,
          panels: [
            { id: 'a', width: 4, body: [row('a1', k()), row('a2', p())] }, // length 2
          ],
        }),
      ],
    });
    expect(result.rows[0].panelSlices).toBeDefined();
    expect(result.rows[0].panelSlices![0].iteration).toBe(1);
    expect(result.rows[0].panelSlices![0].positionInBody).toBe(1);
    // Row 3 is iteration 2, position 1 (loops: 1,2 / 1,2 / 1)
    expect(result.rows[2].panelSlices![0].iteration).toBe(2);
    expect(result.rows[2].panelSlices![0].positionInBody).toBe(1);
    // Row 5 is iteration 3, position 1
    expect(result.rows[4].panelSlices![0].iteration).toBe(3);
  });

  it('combines panel tokens left-to-right in the row tokens array', () => {
    const result = expandSection({
      items: [
        repeatRow({
          kind: 'panel', id: 'p', rows: 1,
          panels: [
            { id: 'a', width: 2, body: [row('a1', k(), p())] },
            { id: 'b', width: 3, body: [row('b1', k(), k(), k())] },
          ],
        }),
      ],
    });
    expect(result.rows[0].tokens.map((t) => t.symbolId)).toEqual(['k', 'p', 'k', 'k', 'k']);
  });

  it('handles panels with empty bodies without crashing', () => {
    const result = expandSection({
      items: [
        repeatRow({
          kind: 'panel', id: 'p', rows: 2,
          panels: [
            { id: 'a', width: 4, body: [] },
            { id: 'b', width: 4, body: [row('b1', k())] },
          ],
        }),
      ],
    });
    expect(result.rows).toHaveLength(2);
    expect(result.warnings.some((w) => w.includes('empty body'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Section-level integration tests
// ---------------------------------------------------------------------------

describe('expandSection — section integration', () => {
  it('numbers expanded rows sequentially across mixed items', () => {
    const result = expandSection({
      items: [
        literalRow(row('s1', k())),
        repeatRow({ kind: 'vertical', id: 'v', body: [row('a', k()), row('b', p())], count: 2 }),
        literalRow(row('end', k())),
      ],
    });
    expect(result.rows.map((r) => r.rowNumber)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('returns empty rows + no warnings for an empty section', () => {
    const result = expandSection({ items: [] });
    expect(result.rows).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('produces warnings at the section level when inner expansions warn', () => {
    const result = expandSection({
      items: [
        literalRow({
          id: 'r1',
          tokens: [{ kind: 'horizontal-repeat', id: 'h', body: [k()], count: -1 }],
        }),
      ],
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
