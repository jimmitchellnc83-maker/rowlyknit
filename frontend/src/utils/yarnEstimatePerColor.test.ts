import { describe, it, expect } from 'vitest';
import { estimatePerColorYardage } from './yarnEstimatePerColor';
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
