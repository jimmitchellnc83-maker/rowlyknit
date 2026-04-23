import { useCallback, useRef, useState } from 'react';
import { KNITTING_SYMBOLS } from '../../data/knittingSymbols';

export interface ChartCell {
  /** Symbol id from KNITTING_SYMBOLS, or null for a blank cell. */
  symbolId: string | null;
  /** Hex color override for colorwork cells. Null = use the symbol's
   *  default color (or white). */
  colorHex: string | null;
}

export interface ChartData {
  width: number;
  height: number;
  /** Row-major. First `width` cells are row 1 (top of chart). */
  cells: ChartCell[];
}

export type ChartTool =
  | { type: 'symbol'; symbolId: string }
  | { type: 'color'; hex: string }
  | { type: 'erase' };

export function emptyChart(width: number, height: number): ChartData {
  return {
    width: Math.max(1, Math.min(60, Math.round(width))),
    height: Math.max(1, Math.min(60, Math.round(height))),
    cells: Array.from({ length: Math.max(1, width) * Math.max(1, height) }, () => ({
      symbolId: null,
      colorHex: null,
    })),
  };
}

/** Resize a chart preserving overlapping cells. Cells outside the new
 *  bounds are dropped; cells in newly-exposed area are blank. */
export function resizeChart(prev: ChartData, width: number, height: number): ChartData {
  const w = Math.max(1, Math.min(60, Math.round(width)));
  const h = Math.max(1, Math.min(60, Math.round(height)));
  const next: ChartCell[] = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (r < prev.height && c < prev.width) {
        next.push(prev.cells[r * prev.width + c] ?? { symbolId: null, colorHex: null });
      } else {
        next.push({ symbolId: null, colorHex: null });
      }
    }
  }
  return { width: w, height: h, cells: next };
}

const SYMBOL_INDEX = new Map(KNITTING_SYMBOLS.map((s) => [s.id, s]));

interface ChartGridProps {
  chart: ChartData;
  onChange: (next: ChartData) => void;
  tool: ChartTool;
  /** Cell edge length in pixels. Default 28 (readable on desktop). */
  cellSize?: number;
}

/**
 * Interactive chart grid. Click cells to apply the active tool; click-drag
 * paints multiple in one gesture. Row numbers run up the right side with
 * RS / WS tags (rightmost shows reading direction — chart rows are knit
 * right-to-left for RS and left-to-right for WS in flat knitting).
 */
export default function ChartGrid({ chart, onChange, tool, cellSize = 28 }: ChartGridProps) {
  const [painting, setPainting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const applyTool = useCallback(
    (index: number) => {
      if (index < 0 || index >= chart.cells.length) return;
      const next = [...chart.cells];
      const cur = next[index];
      if (tool.type === 'erase') {
        next[index] = { symbolId: null, colorHex: null };
      } else if (tool.type === 'symbol') {
        next[index] = { ...cur, symbolId: tool.symbolId };
      } else if (tool.type === 'color') {
        next[index] = { ...cur, colorHex: tool.hex };
      }
      onChange({ ...chart, cells: next });
    },
    [chart, onChange, tool],
  );

  const cellIndexFromEvent = (clientX: number, clientY: number): number => {
    const container = containerRef.current;
    if (!container) return -1;
    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const col = Math.floor(x / cellSize);
    const row = Math.floor(y / cellSize);
    if (col < 0 || col >= chart.width || row < 0 || row >= chart.height) return -1;
    return row * chart.width + col;
  };

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex items-start gap-2">
        {/* Grid */}
        <div
          ref={containerRef}
          className="touch-none select-none border border-gray-400 bg-white dark:border-gray-600 dark:bg-gray-900"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${chart.width}, ${cellSize}px)`,
            gridTemplateRows: `repeat(${chart.height}, ${cellSize}px)`,
          }}
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            const idx = cellIndexFromEvent(e.clientX, e.clientY);
            if (idx >= 0) applyTool(idx);
            setPainting(true);
          }}
          onMouseUp={() => setPainting(false)}
          onMouseLeave={() => setPainting(false)}
          onMouseMove={(e) => {
            if (!painting) return;
            const idx = cellIndexFromEvent(e.clientX, e.clientY);
            if (idx >= 0) applyTool(idx);
          }}
          onTouchStart={(e) => {
            const t = e.touches[0];
            const idx = cellIndexFromEvent(t.clientX, t.clientY);
            if (idx >= 0) applyTool(idx);
            setPainting(true);
          }}
          onTouchMove={(e) => {
            if (!painting) return;
            const t = e.touches[0];
            const idx = cellIndexFromEvent(t.clientX, t.clientY);
            if (idx >= 0) applyTool(idx);
          }}
          onTouchEnd={() => setPainting(false)}
          onTouchCancel={() => setPainting(false)}
          role="grid"
          aria-label="Chart grid"
          aria-rowcount={chart.height}
          aria-colcount={chart.width}
        >
          {chart.cells.map((cell, i) => {
            const sym = cell.symbolId ? SYMBOL_INDEX.get(cell.symbolId) : undefined;
            const bg = cell.colorHex ?? sym?.color ?? '#FFFFFF';
            const fontPx = Math.max(10, Math.round(cellSize * 0.55));
            return (
              <div
                key={i}
                role="gridcell"
                className="flex items-center justify-center border border-gray-200 leading-none dark:border-gray-700"
                style={{
                  backgroundColor: bg,
                  color: luminance(bg) > 0.55 ? '#111' : '#fff',
                  cursor: 'cell',
                  fontSize: `${fontPx}px`,
                }}
                aria-label={sym ? `${sym.name}${cell.colorHex ? `, ${cell.colorHex}` : ''}` : cell.colorHex ?? 'empty'}
              >
                {sym?.symbol ?? ''}
              </div>
            );
          })}
        </div>

        {/* Row numbers — render on the right side, counting up from 1 at
            the bottom to match how knitters read charts. */}
        <div className="flex flex-col-reverse text-[10px] font-mono text-gray-500" style={{ gap: 0 }}>
          {Array.from({ length: chart.height }).map((_, i) => (
            <span
              key={i}
              className="flex items-center"
              style={{ height: cellSize }}
            >
              <span className="ml-1">{i + 1}</span>
              <span className="ml-1 text-[9px] text-gray-400">{i % 2 === 0 ? 'RS' : 'WS'}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Stitch-number row under the chart */}
      <div
        className="mt-1 grid text-[10px] font-mono text-gray-500"
        style={{
          gridTemplateColumns: `repeat(${chart.width}, ${cellSize}px)`,
        }}
      >
        {Array.from({ length: chart.width }).map((_, i) => (
          <span key={i} className="flex items-center justify-center">
            {chart.width - i}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the perceived luminance of a hex color (0–1) so we can pick a
 *  contrasting text color on top of it. Uses the standard sRGB coefficients. */
function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length !== 3) return 1;
  const [r, g, b] = m.map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
