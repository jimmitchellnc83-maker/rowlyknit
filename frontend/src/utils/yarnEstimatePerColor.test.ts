import { describe, it, expect } from 'vitest';
import {
  estimatePerColorYardage,
  displayLabel,
  displayPercent,
  type PerColorYardage,
} from './yarnEstimatePerColor';
import type { ChartData, ChartCell } from '../components/designer/ChartGrid';
import type { ColorSwatch } from '../components/designer/ColorPalette';

const gauge = { stitchesPer4in: 20, rowsPer4in: 28 };
const palette: ColorSwatch[] = [
  { id: 'mc', label: 'Cream', hex: '#FFFFFF' },
  { id: 'cc', label: 'Forest', hex: '#3E5D3A' },
];

const chartOf = (rows: (string | null)[][]): ChartData => {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const cells: ChartCell[] = [];
  for (const r of rows) {
    for (const c of r) cells.push({ symbolId: c ? 'k' : null, colorHex: c });
  }
  return { width, height, cells };
};

describe('estimatePerColorYardage', () => {
  it('returns a single 100% MC row when there is no chart', () => {
    const out = estimatePerColorYardage(2500, gauge, null, palette);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].isMain).toBe(true);
    expect(out.rows[0].fraction).toBe(1);
    expect(out.rows[0].yardage.minYds).toBe(out.total.minYds);
  });

  it('treats blank cells as MC', () => {
    // 4 cells, all blank → 100% MC.
    const chart = chartOf([
      [null, null],
      [null, null],
    ]);
    const out = estimatePerColorYardage(2500, gauge, chart, palette);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].isMain).toBe(true);
    expect(out.rows[0].fraction).toBe(1);
  });

  it('splits proportionally between MC and a CC color', () => {
    // 4 cells, 1 = CC (Forest), 3 = blank/MC → 25 % CC.
    const chart = chartOf([
      ['#3E5D3A', null],
      [null, null],
    ]);
    const out = estimatePerColorYardage(2500, gauge, chart, palette);
    expect(out.rows).toHaveLength(2);
    const mc = out.rows.find((r) => r.isMain)!;
    const cc = out.rows.find((r) => !r.isMain)!;
    expect(mc.fraction).toBeCloseTo(0.75, 5);
    expect(cc.fraction).toBeCloseTo(0.25, 5);
    expect(cc.label).toBe('Forest');
  });

  it('sums per-color min/max within ±1 yd of the total (rounding tolerance)', () => {
    const chart = chartOf([
      ['#3E5D3A', null, '#3E5D3A', null],
      [null, '#3E5D3A', null, '#3E5D3A'],
    ]);
    const out = estimatePerColorYardage(2500, gauge, chart, palette);
    const sumMin = out.rows.reduce((acc, r) => acc + r.yardage.minYds, 0);
    const sumMax = out.rows.reduce((acc, r) => acc + r.yardage.maxYds, 0);
    expect(Math.abs(sumMin - out.total.minYds)).toBeLessThanOrEqual(1);
    expect(Math.abs(sumMax - out.total.maxYds)).toBeLessThanOrEqual(1);
  });

  it('falls back to the hex as label when a color is not in the palette', () => {
    const chart = chartOf([['#abcdef', null]]);
    const out = estimatePerColorYardage(2500, gauge, chart, palette);
    const cc = out.rows.find((r) => !r.isMain)!;
    expect(cc.label).toBe('#ABCDEF');
  });

  it('orders rows MC first, then by descending fraction', () => {
    const chart = chartOf([
      // 8 cells: 2 MC, 4 Forest, 2 #abcdef
      ['#3E5D3A', '#3E5D3A', '#3E5D3A', '#3E5D3A'],
      [null, '#abcdef', null, '#abcdef'],
    ]);
    const out = estimatePerColorYardage(2500, gauge, chart, palette);
    expect(out.rows.map((r) => r.label)).toEqual(['Cream', 'Forest', '#ABCDEF']);
  });

  it('handles a palette with only one color (no CC)', () => {
    const chart = chartOf([['#FFFFFF', null]]);
    const out = estimatePerColorYardage(2500, gauge, chart, [palette[0]]);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].fraction).toBe(1);
  });
});

const row = (overrides: Partial<PerColorYardage> = {}): PerColorYardage => ({
  hex: '#FFFFFF',
  label: 'Cream',
  isMain: false,
  fraction: 0.5,
  yardage: { minYds: 0, maxYds: 0 },
  ...overrides,
});

describe('displayLabel', () => {
  it('prepends "MC · " for the main color row when label has no MC prefix', () => {
    expect(displayLabel(row({ isMain: true, label: 'Cream' }))).toBe('MC · Cream');
  });

  it('does NOT prepend when the label already starts with "MC"', () => {
    expect(
      displayLabel(row({ isMain: true, label: 'MC · Tanis Fiber Arts — Yellow Label DK Weight' })),
    ).toBe('MC · Tanis Fiber Arts — Yellow Label DK Weight');
  });

  it('matches "MC" case-insensitively', () => {
    expect(displayLabel(row({ isMain: true, label: 'mc · cream' }))).toBe('mc · cream');
    expect(displayLabel(row({ isMain: true, label: 'Mc Yarn' }))).toBe('Mc Yarn');
  });

  it('still prepends when the label happens to contain MC mid-string', () => {
    // "Tanis MC Fiber Arts" doesn't start with MC; treat it as a regular name.
    expect(displayLabel(row({ isMain: true, label: 'Tanis MC Fiber Arts' }))).toBe(
      'MC · Tanis MC Fiber Arts',
    );
  });

  it('treats "MCMaster" (no word boundary after MC) as a regular label', () => {
    expect(displayLabel(row({ isMain: true, label: 'MCMaster Yarn' }))).toBe(
      'MC · MCMaster Yarn',
    );
  });

  it('does nothing for non-main rows even if their label starts with MC', () => {
    expect(displayLabel(row({ isMain: false, label: 'Forest' }))).toBe('Forest');
    expect(displayLabel(row({ isMain: false, label: 'MC · Anything' }))).toBe('MC · Anything');
  });

  it('tolerates leading whitespace in the label', () => {
    expect(displayLabel(row({ isMain: true, label: '  MC · Cream' }))).toBe('  MC · Cream');
  });
});

describe('displayPercent', () => {
  it('rounds whole percentages', () => {
    expect(displayPercent(0.5)).toBe('50%');
    expect(displayPercent(0.25)).toBe('25%');
    expect(displayPercent(1)).toBe('100%');
  });

  it('rounds to nearest integer', () => {
    expect(displayPercent(0.236)).toBe('24%');
    expect(displayPercent(0.234)).toBe('23%');
  });

  it('returns "<1%" for non-zero fractions that round to 0%', () => {
    expect(displayPercent(0.004)).toBe('<1%');
    expect(displayPercent(0.0001)).toBe('<1%');
  });

  it('returns "0%" only when fraction is exactly 0', () => {
    expect(displayPercent(0)).toBe('0%');
  });

  it('handles the boundary at 0.01 — counts as 1%, not <1%', () => {
    expect(displayPercent(0.01)).toBe('1%');
  });
});

describe('estimatePerColorYardage no-stitch handling', () => {
  it('excludes no-stitch cells from the color split (they are placeholders, not fabric)', () => {
    // 4-cell chart: 2 MC stitches + 2 no-stitch placeholders.
    // Without the fix, the split would be 100% MC over 4 cells.
    // With the fix, the split is 100% MC over 2 cells — but the absolute
    // total yardage is unchanged because that's derived from the silhouette
    // area, not the cell count. What MUST change is that adding more
    // no-stitch cells does NOT shift the proportions away from CC.
    const chartWithNoStitch: ChartData = {
      width: 4,
      height: 1,
      cells: [
        { symbolId: 'k', colorHex: '#3E5D3A' }, // CC
        { symbolId: 'k', colorHex: null },      // MC (blank colorHex)
        { symbolId: 'no-stitch', colorHex: null },
        { symbolId: 'no-stitch', colorHex: null },
      ],
    };
    const out = estimatePerColorYardage(2500, gauge, chartWithNoStitch, palette);
    // Expect 50/50 — the two no-stitch cells should not pad the MC share.
    const mcRow = out.rows.find((r: PerColorYardage) => r.isMain);
    const ccRow = out.rows.find((r: PerColorYardage) => !r.isMain);
    expect(mcRow?.fraction).toBeCloseTo(0.5, 5);
    expect(ccRow?.fraction).toBeCloseTo(0.5, 5);
  });

  it('falls back to 100% MC when every non-no-stitch cell is also blank', () => {
    const allNoStitchOrBlank: ChartData = {
      width: 4,
      height: 1,
      cells: [
        { symbolId: 'no-stitch', colorHex: null },
        { symbolId: null, colorHex: null },
        { symbolId: 'no-stitch', colorHex: null },
        { symbolId: null, colorHex: null },
      ],
    };
    const out = estimatePerColorYardage(2500, gauge, allNoStitchOrBlank, palette);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].isMain).toBe(true);
    expect(out.rows[0].fraction).toBe(1);
  });
});
