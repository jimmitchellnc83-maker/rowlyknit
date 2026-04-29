import { useCallback, useMemo, useRef, useState } from 'react';
import {
  getCellSpan,
  resolveStitchKey,
  renderStitchInto,
} from '../../data/stitchSvgLibrary';

export interface ChartCell {
  /** Canonical symbol key from chart_symbol_templates.symbol (e.g. 'k', 'sc',
   *  'c4f'), or null for a blank cell. Multi-cell stitches occupy N
   *  consecutive cells with the same symbolId. */
  symbolId: string | null;
  /** Hex color override for colorwork cells. Null = let the symbol render
   *  on a transparent background (white). */
  colorHex: string | null;
}

export interface ChartData {
  width: number;
  height: number;
  /** Row-major. First `width` cells are row 1 (top of chart). */
  cells: ChartCell[];
  /** When true, every row is RS (chart is worked circularly: rounds, not
   *  rows). Drives chart-to-text generation and the row-label gutter
   *  (shows "Rnd" instead of "RS/WS"). Defaults to false (flat work). */
  workedInRound?: boolean;
}

export type ChartTool =
  | { type: 'symbol'; symbolId: string }
  | { type: 'color'; hex: string }
  | { type: 'erase' };

/** Largest chart we'll create. A full adult sweater body is ~100 sts × ~180
 *  rows; this caps at 200×200 so the user can build full-piece charts
 *  without losing the safety net entirely. Manually-resized charts can go
 *  up to this same cap via `resizeChart`. */
const MAX_CHART_DIM = 200;

export function emptyChart(width: number, height: number): ChartData {
  const w = Math.max(1, Math.min(MAX_CHART_DIM, Math.round(width)));
  const h = Math.max(1, Math.min(MAX_CHART_DIM, Math.round(height)));
  return {
    width: w,
    height: h,
    cells: Array.from({ length: w * h }, () => ({
      symbolId: null,
      colorHex: null,
    })),
    workedInRound: false,
  };
}

export function resizeChart(prev: ChartData, width: number, height: number): ChartData {
  const w = Math.max(1, Math.min(MAX_CHART_DIM, Math.round(width)));
  const h = Math.max(1, Math.min(MAX_CHART_DIM, Math.round(height)));
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
  return { ...prev, width: w, height: h, cells: next };
}

interface ChartGridProps {
  chart: ChartData;
  onChange: (next: ChartData) => void;
  tool: ChartTool;
  cellSize?: number;
  /** 1-indexed knitter row number (1 = bottom of chart). When set, that
   *  row is drawn with a bold accent border. Out-of-range values ignored. */
  highlightedRowIndex?: number;
  readOnly?: boolean;
}

interface RunInfo {
  /** Position of THIS cell within a multi-cell run. */
  pos: 'none' | 'single' | 'leader' | 'middle' | 'tail';
  /** True when this cell is the LEADER of a multi-cell run that should
   *  render its symbol as one wide drawing. */
  isLeader: boolean;
  /** Drawing width in cells (1 for single-cell, N for multi-cell leader). */
  drawSpan: number;
}

/**
 * Detect contiguous same-symbol runs per row and assign each cell a
 * RunInfo. Runs longer than the symbol's cellSpan re-tile (e.g. a span-2
 * symbol painted across 6 cells produces three back-to-back leaders).
 */
function computeRuns(chart: ChartData): RunInfo[] {
  const out: RunInfo[] = [];
  for (let r = 0; r < chart.height; r++) {
    let c = 0;
    while (c < chart.width) {
      const cell = chart.cells[r * chart.width + c];
      const sym = cell?.symbolId ?? null;
      if (!sym) {
        out.push({ pos: 'none', isLeader: false, drawSpan: 1 });
        c++;
        continue;
      }
      // Walk forward across same-symbol cells.
      let runLen = 1;
      while (
        c + runLen < chart.width &&
        chart.cells[r * chart.width + c + runLen]?.symbolId === sym
      ) {
        runLen++;
      }
      const span = getCellSpan(sym, 1);
      // Tile the run by drawSpan = min(span, remaining).
      let consumed = 0;
      while (consumed < runLen) {
        const drawSpan = Math.min(span, runLen - consumed);
        if (drawSpan === 1) {
          out.push({ pos: 'single', isLeader: true, drawSpan: 1 });
        } else {
          out.push({ pos: 'leader', isLeader: true, drawSpan });
          for (let k = 1; k < drawSpan - 1; k++) {
            out.push({ pos: 'middle', isLeader: false, drawSpan: 1 });
          }
          out.push({ pos: 'tail', isLeader: false, drawSpan: 1 });
        }
        consumed += drawSpan;
      }
      c += runLen;
    }
  }
  return out;
}

export default function ChartGrid({
  chart,
  onChange,
  tool,
  cellSize = 28,
  highlightedRowIndex,
  readOnly = false,
}: ChartGridProps) {
  const [painting, setPainting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const highlightedGridRow =
    highlightedRowIndex && highlightedRowIndex >= 1 && highlightedRowIndex <= chart.height
      ? chart.height - highlightedRowIndex
      : null;

  // Painting helper — for multi-cell symbols, paints the run rightward
  // from the click position, clipped to the row's right edge.
  const applyTool = useCallback(
    (index: number) => {
      if (readOnly) return;
      if (index < 0 || index >= chart.cells.length) return;
      const next = [...chart.cells];
      const row = Math.floor(index / chart.width);
      const col = index - row * chart.width;
      if (tool.type === 'erase') {
        next[index] = { symbolId: null, colorHex: null };
      } else if (tool.type === 'color') {
        next[index] = { ...next[index], colorHex: tool.hex };
      } else if (tool.type === 'symbol') {
        const span = getCellSpan(tool.symbolId, 1);
        const drawSpan = Math.min(span, chart.width - col);
        for (let k = 0; k < drawSpan; k++) {
          const i = row * chart.width + col + k;
          next[i] = { ...next[i], symbolId: tool.symbolId };
        }
      }
      onChange({ ...chart, cells: next });
    },
    [chart, onChange, tool, readOnly],
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

  const runs = useMemo(() => computeRuns(chart), [chart]);

  // Build the SVG symbol overlay — one <svg> covering the whole grid, with
  // each leader cell drawn in its own translated <g>. Cells with no symbol
  // contribute nothing.
  const overlayNodes = useMemo(() => {
    const nodes = [];
    for (let r = 0; r < chart.height; r++) {
      for (let c = 0; c < chart.width; c++) {
        const i = r * chart.width + c;
        const info = runs[i];
        if (!info?.isLeader) continue;
        const cell = chart.cells[i];
        const sym = cell.symbolId;
        if (!sym) continue;
        const bg = cell.colorHex ?? '#FFFFFF';
        const stroke = luminance(bg) > 0.55 ? '#111111' : '#FFFFFF';
        const node = renderStitchInto({
          id: sym,
          x: c * cellSize,
          y: r * cellSize,
          width: info.drawSpan * cellSize,
          height: cellSize,
          stroke,
          keyPrefix: `s-${r}-${c}`,
        });
        if (node) nodes.push(node);
      }
    }
    return nodes;
  }, [chart, runs, cellSize]);

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex items-start gap-2">
        {/* Grid + symbol overlay stacked */}
        <div className="relative">
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
              const info = runs[i] ?? { pos: 'none', isLeader: false, drawSpan: 1 };
              const bg = cell.colorHex ?? '#FFFFFF';
              const row = Math.floor(i / chart.width);
              const isActive = highlightedGridRow !== null && row === highlightedGridRow;
              // Hide internal vertical borders inside multi-cell runs so the
              // run reads as a single wide cell. We hide:
              //   leader: right border  (next cell is middle/tail)
              //   middle: both vertical borders
              //   tail: left border
              const noLeftBorder = info.pos === 'middle' || info.pos === 'tail';
              const noRightBorder = info.pos === 'middle' || info.pos === 'leader';
              const sym = cell.symbolId ? resolveStitchKey(cell.symbolId) : null;
              return (
                <div
                  key={i}
                  role="gridcell"
                  aria-current={isActive ? 'true' : undefined}
                  className={`leading-none ${
                    isActive
                      ? 'border-y-2 border-amber-500 dark:border-amber-400'
                      : 'border-y border-gray-200 dark:border-gray-700'
                  } ${noLeftBorder ? 'border-l-0' : isActive ? 'border-l-0' : 'border-l border-gray-200 dark:border-gray-700'} ${noRightBorder ? 'border-r-0' : isActive ? 'border-r-0' : 'border-r border-gray-200 dark:border-gray-700'}`}
                  style={{
                    backgroundColor: bg,
                    cursor: readOnly ? 'default' : 'cell',
                    boxShadow: isActive ? 'inset 0 0 0 1px rgba(245, 158, 11, 0.35)' : undefined,
                  }}
                  aria-label={
                    sym
                      ? `${sym}${cell.colorHex ? `, ${cell.colorHex}` : ''}${info.drawSpan > 1 ? `, ${info.drawSpan} cells wide` : ''}`
                      : cell.colorHex ?? 'empty'
                  }
                />
              );
            })}
          </div>
          {/* Symbol overlay sits above the grid cells but does not block
              clicks (pointer-events:none) so painting still hits the
              cells underneath. */}
          {overlayNodes.length > 0 && (
            <svg
              className="pointer-events-none absolute inset-0"
              width={chart.width * cellSize}
              height={chart.height * cellSize}
              viewBox={`0 0 ${chart.width * cellSize} ${chart.height * cellSize}`}
              aria-hidden="true"
            >
              {overlayNodes}
            </svg>
          )}
        </div>

        {/* Row numbers */}
        <div className="flex flex-col-reverse text-[10px] font-mono text-gray-500" style={{ gap: 0 }}>
          {Array.from({ length: chart.height }).map((_, i) => {
            const isActive = highlightedRowIndex === i + 1;
            const sideLabel = chart.workedInRound ? 'Rnd' : i % 2 === 0 ? 'RS' : 'WS';
            return (
              <span
                key={i}
                className={`flex items-center ${isActive ? 'font-bold text-amber-600 dark:text-amber-400' : ''}`}
                style={{ height: cellSize }}
              >
                <span className="ml-1">{i + 1}</span>
                <span className="ml-1 text-[9px] text-gray-400">{sideLabel}</span>
              </span>
            );
          })}
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

function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length !== 3) return 1;
  const [r, g, b] = m.map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
