import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import ChartOverlay from './ChartOverlay';
import type { ChartData } from './ChartGrid';

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
});
