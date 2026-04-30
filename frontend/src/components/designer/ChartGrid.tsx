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

/** Optional bold-bordered region marking the repeat unit within a chart.
 *  All indices are 0-based, inclusive, and address columns from the LEFT
 *  (column 0 = leftmost cell in the cells array) and rows from the TOP
 *  (row 0 = top of the cells array; knitter row 1 = chart.height - 1).
 *  The chart designer UI presents columns to the knitter using stitch
 *  numbers (1-indexed from the right) and rows using row numbers
 *  (1-indexed from the BOTTOM), and converts on save.
 *
 *  Row range is OPTIONAL — when omitted, the box spans the full chart
 *  height (the original behavior). Most repeat motifs are
 *  horizontal-only; vertical bounds matter for "this 4-row band repeats
 *  N times before yoke shaping" patterns. */
export interface ChartRepeatRegion {
  startCol: number;
  endCol: number;
  startRow?: number;
  endRow?: number;
}

/** Translucent overlay color tags. Knitters use these to mark cells
 *  the way they'd use sticky notes on a physical chart — "remember this
 *  is a decrease" / "swap to CC2 here" / "I'm working through this band
 *  next." Three presets to keep the UI bounded; named so they survive
 *  a future palette rework. */
export type HighlightColor = 'yellow' | 'orange' | 'green';

export interface ChartData {
  width: number;
  height: number;
  /** Row-major. First `width` cells are row 1 (top of chart). */
  cells: ChartCell[];
  /** When true, every row is RS (chart is worked circularly: rounds, not
   *  rows). Drives chart-to-text generation and the row-label gutter
   *  (shows "Rnd" instead of "RS/WS"). Defaults to false (flat work). */
  workedInRound?: boolean;
  /** Knitting convention: a chart can flag a sub-range of columns as the
   *  repeat unit (drawn with a bold border). The cast-on preamble derives
   *  "multiple of N sts, plus E" from this. */
  repeatRegion?: ChartRepeatRegion;
  /** Optional per-row notes the knitter wants surfaced alongside the
   *  written instructions. Keys are KNITTER row numbers (1-indexed from
   *  the bottom; row 1 = first row knit). String values to keep the
   *  payload trivially JSON-serializable. */
  rowNotes?: Record<string, string>;
  /** Sparse map of cell-index → highlight color. Translucent overlay
   *  drawn above the symbol layer; doesn't change the underlying stitch
   *  data (compatible with print + export). Cell index is the offset
   *  into the cells array; string keys for JSON serializability. */
  highlights?: Record<string, HighlightColor>;
}

export type ChartTool =
  | { type: 'symbol'; symbolId: string }
  | { type: 'color'; hex: string }
  | { type: 'highlight'; color: HighlightColor }
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
  // Drop a stored repeat region whose columns or rows no longer fit.
  // Clamping would silently change the user's repeat dimensions, which
  // is worse than making them re-mark the region — so we just clear it.
  const r = prev.repeatRegion;
  const colsOk = !!r && r.startCol >= 0 && r.endCol < w && r.startCol <= r.endCol;
  const rowsOk =
    !r ||
    (r.startRow === undefined && r.endRow === undefined) ||
    (typeof r.startRow === 'number' &&
      typeof r.endRow === 'number' &&
      r.startRow >= 0 &&
      r.endRow < h &&
      r.startRow <= r.endRow);
  const repeatRegion = r && colsOk && rowsOk ? r : undefined;
  return { ...prev, width: w, height: h, cells: next, repeatRegion };
}

interface ChartGridProps {
  chart: ChartData;
  onChange: (next: ChartData) => void;
  tool: ChartTool;
  cellSize?: number;
  /** Cell aspect ratio (height / width). 1.0 = square cells (the default
   *  knit-chart convention). When the user knows their gauge, the chart
   *  can be rendered in *true gauge* by passing
   *  `stitchesPer4in / rowsPer4in` so a row of cells looks like a row of
   *  finished fabric. For typical stockinette this is < 1 (cells are
   *  wider than tall, matching real knit stitches). */
  cellAspect?: number;
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
  cellAspect = 1,
  highlightedRowIndex,
  readOnly = false,
}: ChartGridProps) {
  const [painting, setPainting] = useState(false);
  // Keyboard-focused cell index (cells-array offset). Null when the
  // grid hasn't been focused or when the user has clicked into another
  // input. Arrow keys move it; Space/Enter paints with the active
  // tool. Render an amber ring around it so it's visible.
  const [activeCellIndex, setActiveCellIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // cellSize sets the WIDTH; height scales by aspect (height/width) so a
  // gauge-aware aspect < 1 makes cells visibly shorter than they are wide,
  // matching that knit stitches are wider than tall.
  const cellWidth = cellSize;
  const cellHeight = Math.max(4, Math.round(cellSize * cellAspect));

  const highlightedGridRow =
    highlightedRowIndex && highlightedRowIndex >= 1 && highlightedRowIndex <= chart.height
      ? chart.height - highlightedRowIndex
      : null;

  // Painting helper — for multi-cell symbols, paints the run rightward
  // from the click position, clipped to the row's right edge. Highlights
  // are stored separately from cell data so they don't pollute exports
  // or written instructions.
  const applyTool = useCallback(
    (index: number) => {
      if (readOnly) return;
      if (index < 0 || index >= chart.cells.length) return;

      // Highlight tool writes to the sparse highlights map, not the cells
      // array. Re-clicking the same color toggles it off so a single tool
      // selection covers paint + erase for that color.
      if (tool.type === 'highlight') {
        const highlights = { ...(chart.highlights ?? {}) };
        const key = String(index);
        if (highlights[key] === tool.color) delete highlights[key];
        else highlights[key] = tool.color;
        if (Object.keys(highlights).length === 0) {
          const { highlights: _h, ...rest } = chart;
          onChange(rest);
        } else {
          onChange({ ...chart, highlights });
        }
        return;
      }

      const next = [...chart.cells];
      const row = Math.floor(index / chart.width);
      const col = index - row * chart.width;
      if (tool.type === 'erase') {
        next[index] = { symbolId: null, colorHex: null };
        // Erase also clears the highlight on that cell so the user
        // doesn't end up with an orphan tag floating in space.
        if (chart.highlights && chart.highlights[String(index)]) {
          const highlights = { ...chart.highlights };
          delete highlights[String(index)];
          const cleaned = Object.keys(highlights).length === 0 ? undefined : highlights;
          onChange({ ...chart, cells: next, highlights: cleaned });
          return;
        }
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
    const col = Math.floor(x / cellWidth);
    const row = Math.floor(y / cellHeight);
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
          x: c * cellWidth,
          y: r * cellHeight,
          width: info.drawSpan * cellWidth,
          height: cellHeight,
          stroke,
          keyPrefix: `s-${r}-${c}`,
        });
        if (node) nodes.push(node);
      }
    }
    return nodes;
  }, [chart, runs, cellWidth, cellHeight]);

  // Row-number gutter rendering. Knitting convention:
  //   • Flat: RS rows numbered on the RIGHT (worked R→L), WS on the
  //     LEFT (worked L→R). Reading direction visible from which side
  //     the number sits.
  //   • In the round: all rows numbered on the RIGHT (always R→L).
  // Row 0 is the bottom-of-chart, row chart.height-1 is the top, so
  // the column displays bottom-up via `flex-col-reverse`.
  const renderRowGutter = (side: 'left' | 'right') => (
    <div
      className="flex flex-col-reverse text-[10px] font-mono text-gray-500"
      style={{ gap: 0 }}
      aria-hidden="true"
    >
      {Array.from({ length: chart.height }).map((_, i) => {
        const isActive = highlightedRowIndex === i + 1;
        // Display row number on this side iff:
        //   - in the round → only RIGHT
        //   - flat → RS (odd-numbered, i even since i is 0-indexed)
        //     on RIGHT, WS on LEFT
        let showOnThisSide: boolean;
        if (chart.workedInRound) {
          showOnThisSide = side === 'right';
        } else {
          const isRS = i % 2 === 0; // row 1 (i=0) = RS by convention
          showOnThisSide = (isRS && side === 'right') || (!isRS && side === 'left');
        }
        return (
          <span
            key={i}
            className={`flex items-center ${
              isActive ? 'font-bold text-amber-600 dark:text-amber-400' : ''
            } ${side === 'left' ? 'justify-end' : ''}`}
            style={{ height: cellHeight, minWidth: '1.5rem' }}
          >
            {showOnThisSide ? (
              <span className={side === 'left' ? 'mr-1' : 'ml-1'}>{i + 1}</span>
            ) : null}
          </span>
        );
      })}
    </div>
  );

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex items-start gap-2">
        {/* Left row-number gutter (WS rows for flat, empty in-the-round) */}
        {!chart.workedInRound && renderRowGutter('left')}
        {/* Grid + symbol overlay stacked */}
        <div className="relative">
          <div
            ref={containerRef}
            tabIndex={readOnly ? -1 : 0}
            className="touch-none select-none border border-gray-400 bg-white outline-none focus:ring-2 focus:ring-purple-400 dark:border-gray-600 dark:bg-gray-900"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${chart.width}, ${cellWidth}px)`,
              gridTemplateRows: `repeat(${chart.height}, ${cellHeight}px)`,
            }}
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              const idx = cellIndexFromEvent(e.clientX, e.clientY);
              if (idx >= 0) {
                applyTool(idx);
                setActiveCellIndex(idx);
              }
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
              if (idx >= 0) {
                applyTool(idx);
                setActiveCellIndex(idx);
              }
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
            onKeyDown={(e) => {
              if (readOnly) return;
              const total = chart.width * chart.height;
              if (total === 0) return;
              const cur = activeCellIndex ?? 0;
              const r = Math.floor(cur / chart.width);
              const c = cur - r * chart.width;
              let next = cur;
              switch (e.key) {
                case 'ArrowLeft':
                  next = r * chart.width + Math.max(0, c - 1);
                  break;
                case 'ArrowRight':
                  next = r * chart.width + Math.min(chart.width - 1, c + 1);
                  break;
                case 'ArrowUp':
                  next = Math.max(0, (r - 1)) * chart.width + c;
                  break;
                case 'ArrowDown':
                  next = Math.min(chart.height - 1, r + 1) * chart.width + c;
                  break;
                case '[':
                  // Prev row in knitter terms (row 1 = bottom, so [ is "up the chart").
                  next = Math.max(0, (r - 1)) * chart.width + c;
                  break;
                case ']':
                  next = Math.min(chart.height - 1, r + 1) * chart.width + c;
                  break;
                case ' ':
                case 'Enter':
                  applyTool(cur);
                  e.preventDefault();
                  return;
                case 'Escape':
                  setActiveCellIndex(null);
                  e.preventDefault();
                  return;
                default:
                  return;
              }
              if (next !== cur || activeCellIndex === null) {
                setActiveCellIndex(next);
              }
              e.preventDefault();
            }}
            role="grid"
            aria-label="Chart grid (arrow keys to navigate, Space to paint, [ ] for prev/next row)"
            aria-rowcount={chart.height}
            aria-colcount={chart.width}
          >
            {chart.cells.map((cell, i) => {
              const info = runs[i] ?? { pos: 'none', isLeader: false, drawSpan: 1 };
              const bg = cell.colorHex ?? '#FFFFFF';
              const row = Math.floor(i / chart.width);
              const isActive = highlightedGridRow !== null && row === highlightedGridRow;
              const isFocused = i === activeCellIndex;
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
                    boxShadow: isFocused
                      ? 'inset 0 0 0 2px #a855f7'
                      : isActive
                        ? 'inset 0 0 0 1px rgba(245, 158, 11, 0.35)'
                        : undefined,
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
              width={chart.width * cellWidth}
              height={chart.height * cellHeight}
              viewBox={`0 0 ${chart.width * cellWidth} ${chart.height * cellHeight}`}
              aria-hidden="true"
            >
              {overlayNodes}
            </svg>
          )}
          {/* Highlight overlay — translucent rects on tagged cells. Drawn
              above symbols so the highlight tints whatever's beneath
              without changing the underlying cell data. */}
          {chart.highlights && Object.keys(chart.highlights).length > 0 && (
            <svg
              className="pointer-events-none absolute inset-0"
              width={chart.width * cellWidth}
              height={chart.height * cellHeight}
              viewBox={`0 0 ${chart.width * cellWidth} ${chart.height * cellHeight}`}
              aria-hidden="true"
            >
              {Object.entries(chart.highlights).map(([key, color]) => {
                const idx = parseInt(key, 10);
                if (!Number.isFinite(idx) || idx < 0 || idx >= chart.cells.length) return null;
                const r = Math.floor(idx / chart.width);
                const c = idx - r * chart.width;
                const fill =
                  color === 'yellow'
                    ? 'rgba(250, 204, 21, 0.55)'
                    : color === 'orange'
                      ? 'rgba(251, 146, 60, 0.55)'
                      : 'rgba(74, 222, 128, 0.55)';
                return (
                  <rect
                    key={`hi-${key}`}
                    x={c * cellWidth}
                    y={r * cellHeight}
                    width={cellWidth}
                    height={cellHeight}
                    fill={fill}
                  />
                );
              })}
            </svg>
          )}
          {/* Repeat-box overlay — bold dashed border around the repeat
              columns (and rows when set). pointer-events:none so
              painting still works inside the box. */}
          {(() => {
            const r = chart.repeatRegion;
            if (!r) return null;
            if (r.startCol < 0 || r.endCol >= chart.width || r.startCol > r.endCol) return null;
            const hasRowBounds =
              typeof r.startRow === 'number' && typeof r.endRow === 'number';
            if (
              hasRowBounds &&
              (r.startRow! < 0 || r.endRow! >= chart.height || r.startRow! > r.endRow!)
            ) {
              return null;
            }
            const top = hasRowBounds ? r.startRow! * cellHeight : 0;
            const height = hasRowBounds
              ? (r.endRow! - r.startRow! + 1) * cellHeight
              : chart.height * cellHeight;
            return (
              <div
                className="pointer-events-none absolute border-2 border-dashed border-purple-600 dark:border-purple-400"
                style={{
                  left: r.startCol * cellWidth,
                  top,
                  width: (r.endCol - r.startCol + 1) * cellWidth,
                  height,
                }}
                aria-label="Repeat unit"
                role="presentation"
              />
            );
          })()}
        </div>

        {/* Right row-number gutter — RS rows for flat, all rows for in-the-round */}
        {renderRowGutter('right')}
      </div>

      {/* Stitch-number row under the chart */}
      <div
        className="mt-1 grid text-[10px] font-mono text-gray-500"
        style={{
          gridTemplateColumns: `repeat(${chart.width}, ${cellWidth}px)`,
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
