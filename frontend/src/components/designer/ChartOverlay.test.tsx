import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ChartOverlay from './ChartOverlay';
import type { ChartData } from './ChartGrid';
import type { ExpandedRow } from '../../types/repeat';

function makeChart(width: number, height: number, fill: (r: number, c: number) => string | null): ChartData {
  const cells = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      cells.push({ symbolId: null, colorHex: fill(r, c) });
    }
  }
  return { width, height, cells };
}

const SQUARE_PATH = 'M 0 0 L 100 0 L 100 100 L 0 100 Z';
const BOUNDS = { x: 0, y: 0, width: 100, height: 100 };

function renderInSvg(node: React.ReactElement) {
  return render(<svg viewBox="0 0 100 100">{node}</svg>);
}

describe('ChartOverlay', () => {
  it('renders nothing when chart is null', () => {
    const { container } = renderInSvg(
      <ChartOverlay
        chart={null}
        clipPath={SQUARE_PATH}
        bounds={BOUNDS}
        stitchToPx={10}
        rowToPx={10}
        clipId="t1"
      />,
    );
    // Only the wrapping <svg> is in the tree, no <rect> children
    expect(container.querySelectorAll('rect').length).toBe(0);
  });

  it('renders nothing when no cells have a color', () => {
    const blank = makeChart(2, 2, () => null);
    const { container } = renderInSvg(
      <ChartOverlay
        chart={blank}
        clipPath={SQUARE_PATH}
        bounds={BOUNDS}
        stitchToPx={10}
        rowToPx={10}
        clipId="t2"
      />,
    );
    expect(container.querySelectorAll('rect').length).toBe(0);
  });

  it('renders one rect per colored cell, tiled across bounds', () => {
    // 5×5 chart with one corner cell colored (top-left visually)
    const chart = makeChart(5, 5, (r, c) => (r === 0 && c === 0 ? '#ff0000' : null));
    // bounds: 100×100, cells: 10×10 → chart copy is 50×50 → 2 horizontal × 2 vertical = 4 copies
    const { container } = renderInSvg(
      <ChartOverlay
        chart={chart}
        clipPath={SQUARE_PATH}
        bounds={BOUNDS}
        stitchToPx={10}
        rowToPx={10}
        clipId="t3"
      />,
    );
    // 4 chart copies × 1 colored cell per copy = 4 rects
    expect(container.querySelectorAll('rect').length).toBe(4);
  });

  it('skips cells without colorHex even when symbolId is set', () => {
    const chart: ChartData = {
      width: 2,
      height: 1,
      cells: [
        { symbolId: 'k', colorHex: null },
        { symbolId: null, colorHex: '#00ff00' },
      ],
    };
    const { container } = renderInSvg(
      <ChartOverlay
        chart={chart}
        clipPath={SQUARE_PATH}
        bounds={{ x: 0, y: 0, width: 20, height: 10 }}
        stitchToPx={10}
        rowToPx={10}
        clipId="t4"
      />,
    );
    // Only the green cell renders
    const rects = Array.from(container.querySelectorAll('rect'));
    expect(rects.length).toBe(1);
    expect(rects[0].getAttribute('fill')).toBe('#00ff00');
  });

  it('emits a clipPath element with the supplied id', () => {
    const chart = makeChart(1, 1, () => '#0000ff');
    const { container } = renderInSvg(
      <ChartOverlay
        chart={chart}
        clipPath={SQUARE_PATH}
        bounds={BOUNDS}
        stitchToPx={10}
        rowToPx={10}
        clipId="my-unique-clip-id"
      />,
    );
    const clip = container.querySelector('clipPath');
    expect(clip).not.toBeNull();
    expect(clip?.getAttribute('id')).toBe('my-unique-clip-id');
    const wrapper = container.querySelector('[clip-path]');
    expect(wrapper?.getAttribute('clip-path')).toBe('url(#my-unique-clip-id)');
  });

  it('returns null on zero-size cells', () => {
    const chart = makeChart(1, 1, () => '#0000ff');
    const { container } = renderInSvg(
      <ChartOverlay
        chart={chart}
        clipPath={SQUARE_PATH}
        bounds={BOUNDS}
        stitchToPx={0}
        rowToPx={10}
        clipId="t5"
      />,
    );
    expect(container.querySelectorAll('rect').length).toBe(0);
  });

  it('renders symbols when renderSymbols=true even without a colorHex', () => {
    const chart: ChartData = {
      width: 1,
      height: 1,
      // Purl ('p') renders as a small filled circle in the SVG library.
      cells: [{ symbolId: 'p', colorHex: null }],
    };
    const { container } = renderInSvg(
      <ChartOverlay
        chart={chart}
        clipPath={SQUARE_PATH}
        bounds={BOUNDS}
        stitchToPx={20}
        rowToPx={20}
        clipId="t6"
        renderSymbols
      />,
    );
    // Symbol-only cells get a white background rect for legibility.
    const rects = Array.from(container.querySelectorAll('rect'));
    expect(rects.length).toBeGreaterThan(0);
    // The purl SVG draws at least one <circle> as the artwork.
    const circles = Array.from(container.querySelectorAll('circle'));
    expect(circles.length).toBeGreaterThan(0);
  });

  it('renders multi-cell stitches as one wide artwork', () => {
    // 'c4f' is a span-4 cable. Painted across 4 consecutive cells in the
    // same row, it should produce a single <g> for the cable artwork
    // (drawn into a 4-cell-wide rect).
    const chart: ChartData = {
      width: 4,
      height: 1,
      cells: [
        { symbolId: 'c4f', colorHex: null },
        { symbolId: 'c4f', colorHex: null },
        { symbolId: 'c4f', colorHex: null },
        { symbolId: 'c4f', colorHex: null },
      ],
    };
    const { container } = renderInSvg(
      <ChartOverlay
        chart={chart}
        clipPath={SQUARE_PATH}
        bounds={{ x: 0, y: 0, width: 80, height: 20 }}
        stitchToPx={20}
        rowToPx={20}
        clipId="t-cable"
        renderSymbols
      />,
    );
    // Two curves cross to draw the cable — both <path> elements live in a
    // single <g>. We assert at least one <path> rendered.
    const paths = Array.from(container.querySelectorAll('path'));
    expect(paths.length).toBeGreaterThan(0);
  });

  it('honours minCellSize so symbols stay legible at schematic scale', () => {
    // Native stitchToPx of 2px would tile the chart 50× across the 100px
    // bounds — far too small to read. minCellSize=14 forces 14px cells.
    const chart = makeChart(5, 5, (r, c) => (r === 0 && c === 0 ? '#ff0000' : null));
    const { container } = renderInSvg(
      <ChartOverlay
        chart={chart}
        clipPath={SQUARE_PATH}
        bounds={BOUNDS}
        stitchToPx={2}
        rowToPx={2}
        clipId="t7"
        minCellSize={14}
      />,
    );
    const rects = Array.from(container.querySelectorAll('rect'));
    expect(rects.length).toBeGreaterThan(0);
    // Each rendered cell rect should be at the minimum 14px, not the
    // stitchToPx of 2 — that's the whole point of the minimum.
    for (const r of rects) {
      expect(r.getAttribute('width')).toBe('14');
      expect(r.getAttribute('height')).toBe('14');
    }
  });

  // ---------------------------------------------------------------------
  // Canonical chart layer (PR 8 of the Designer rebuild)
  // ---------------------------------------------------------------------
  describe('placement.repeatMode = "single"', () => {
    it('renders exactly one chart copy at the bottom-left anchor', () => {
      // 1×1 red chart, 100×100 bounds, 10px cells. Tile mode would
      // produce 10×10 = 100 copies; single mode produces exactly 1.
      const chart = makeChart(1, 1, () => '#ff0000');
      const { container } = renderInSvg(
        <ChartOverlay
          chart={chart}
          clipPath={SQUARE_PATH}
          bounds={BOUNDS}
          stitchToPx={10}
          rowToPx={10}
          clipId="t-single"
          placement={{ repeatMode: 'single' }}
        />,
      );
      const rects = Array.from(container.querySelectorAll('rect'));
      expect(rects.length).toBe(1);
      // Anchored at bottom-left: x=0, y=bottom-cellH=90.
      expect(rects[0].getAttribute('x')).toBe('0');
      expect(rects[0].getAttribute('y')).toBe('90');
    });

    it('renders one copy when repeatMode is "panel-aware"', () => {
      // Until the panel-slice pipeline lands, panel-aware behaves like single.
      const chart = makeChart(1, 1, () => '#00ff00');
      const { container } = renderInSvg(
        <ChartOverlay
          chart={chart}
          clipPath={SQUARE_PATH}
          bounds={BOUNDS}
          stitchToPx={10}
          rowToPx={10}
          clipId="t-panel"
          placement={{ repeatMode: 'panel-aware' }}
        />,
      );
      expect(container.querySelectorAll('rect').length).toBe(1);
    });
  });

  describe('placement.offset', () => {
    it('shifts the anchor right by offset.x stitches in single mode', () => {
      const chart = makeChart(1, 1, () => '#0000ff');
      const { container } = renderInSvg(
        <ChartOverlay
          chart={chart}
          clipPath={SQUARE_PATH}
          bounds={BOUNDS}
          stitchToPx={10}
          rowToPx={10}
          clipId="t-offset-x"
          placement={{ repeatMode: 'single', offset: { x: 3, y: 0 } }}
        />,
      );
      const rect = container.querySelector('rect');
      expect(rect?.getAttribute('x')).toBe('30');
    });

    it('shifts the anchor up by offset.y rows in single mode', () => {
      const chart = makeChart(1, 1, () => '#0000ff');
      const { container } = renderInSvg(
        <ChartOverlay
          chart={chart}
          clipPath={SQUARE_PATH}
          bounds={BOUNDS}
          stitchToPx={10}
          rowToPx={10}
          clipId="t-offset-y"
          placement={{ repeatMode: 'single', offset: { x: 0, y: 5 } }}
        />,
      );
      const rect = container.querySelector('rect');
      // bottom (100) - cellH (10) - offsetY * cellH (50) = 40.
      expect(rect?.getAttribute('y')).toBe('40');
    });

    it('shifts the tile anchor right by offset.x in tile mode', () => {
      // 1×1 red chart in 30×10 bounds, 10px cells. Tile mode without
      // offset produces 3 copies at x=0, 10, 20. offset.x=1 moves the
      // anchor to x=10, so tile copies appear at x=10, 20.
      const chart = makeChart(1, 1, () => '#ff00ff');
      const bounds = { x: 0, y: 0, width: 30, height: 10 };
      const { container: noOffset } = renderInSvg(
        <ChartOverlay
          chart={chart}
          clipPath={SQUARE_PATH}
          bounds={bounds}
          stitchToPx={10}
          rowToPx={10}
          clipId="t-tile-no-offset"
        />,
      );
      const { container: withOffset } = renderInSvg(
        <ChartOverlay
          chart={chart}
          clipPath={SQUARE_PATH}
          bounds={bounds}
          stitchToPx={10}
          rowToPx={10}
          clipId="t-tile-with-offset"
          placement={{ offset: { x: 1, y: 0 } }}
        />,
      );
      const noOffXs = Array.from(noOffset.querySelectorAll('rect'))
        .map((r) => Number(r.getAttribute('x')))
        .sort((a, b) => a - b);
      const withOffXs = Array.from(withOffset.querySelectorAll('rect'))
        .map((r) => Number(r.getAttribute('x')))
        .sort((a, b) => a - b);
      expect(noOffXs).toEqual([0, 10, 20]);
      expect(withOffXs).toEqual([10, 20]);
    });
  });

  describe('expandedRows clamps vertical extent', () => {
    const fakeRow = (rowNumber: number): ExpandedRow => ({
      rowNumber,
      tokens: [],
      source: { blockId: null, iteration: 1, positionInBody: 1, rowId: null },
      warnings: [],
    });

    it('limits tile copies to expandedRows.length rows tall', () => {
      // 1×1 red chart in 100×100 bounds with 10px cells. Without limit,
      // tile fills bounds (100/10 = 10 vertical copies × 10 horizontal
      // = 100). With expandedRows.length=3, only 3 vertical rows render
      // (still 10 horizontal = 30 copies).
      const chart = makeChart(1, 1, () => '#ff0000');
      const expandedRows = [fakeRow(1), fakeRow(2), fakeRow(3)];
      const { container } = renderInSvg(
        <ChartOverlay
          chart={chart}
          clipPath={SQUARE_PATH}
          bounds={BOUNDS}
          stitchToPx={10}
          rowToPx={10}
          clipId="t-expanded"
          expandedRows={expandedRows}
        />,
      );
      // 3 vertical × 10 horizontal copies = 30 rects.
      expect(container.querySelectorAll('rect').length).toBe(30);
    });

    it('does not extend below the bounds top when limit exceeds bounds', () => {
      // expandedRows asks for 999 rows but bounds is only 10 cells tall.
      // The clamp keeps tiling within bounds — the canonical row count
      // is the *maximum*, not a forced extent.
      const chart = makeChart(1, 1, () => '#ff0000');
      const expandedRows = Array.from({ length: 999 }, (_, i) => fakeRow(i + 1));
      const { container } = renderInSvg(
        <ChartOverlay
          chart={chart}
          clipPath={SQUARE_PATH}
          bounds={BOUNDS}
          stitchToPx={10}
          rowToPx={10}
          clipId="t-expanded-clamp"
          expandedRows={expandedRows}
        />,
      );
      // 10 vertical × 10 horizontal = 100 (full fill).
      expect(container.querySelectorAll('rect').length).toBe(100);
    });

    it('legacy behavior preserved when expandedRows is omitted', () => {
      // Sanity check: zero placement props, zero expandedRows → identical
      // output to the pre-PR-8 ChartOverlay.
      const chart = makeChart(1, 1, () => '#ff0000');
      const { container } = renderInSvg(
        <ChartOverlay
          chart={chart}
          clipPath={SQUARE_PATH}
          bounds={BOUNDS}
          stitchToPx={10}
          rowToPx={10}
          clipId="t-legacy"
        />,
      );
      // 10 vertical × 10 horizontal = 100 (full fill).
      expect(container.querySelectorAll('rect').length).toBe(100);
    });
  });
});
