import type { ReactElement } from 'react';
import { KNITTING_SYMBOLS } from '../../data/knittingSymbols';
import type { ChartData } from './ChartGrid';

const SYMBOL_INDEX = new Map(KNITTING_SYMBOLS.map((s) => [s.id, s]));

interface ChartOverlayProps {
  chart: ChartData | null;
  /** SVG path string defining the silhouette to clip the overlay to. */
  clipPath: string;
  /** Bounding rectangle of the area to tile chart cells within. The
   *  clipPath does the final masking so this can safely be a generous
   *  bounding box (e.g. the schematic's full draw area). */
  bounds: { x: number; y: number; width: number; height: number };
  /** Pixel size of one stitch (chart cell width). */
  stitchToPx: number;
  /** Pixel size of one knitted row (chart cell height). */
  rowToPx: number;
  /** Unique id for the clipPath element (must be unique within the page). */
  clipId: string;
  /** When true, also tile cells that have a symbolId but no colorHex, and
   *  draw the symbol character inside each cell. Default false preserves
   *  the legacy color-only overlay used by tests. */
  renderSymbols?: boolean;
  /** Minimum cell edge length in pixels. When stitchToPx (or rowToPx) is
   *  below this, the overlay tiles at this larger size so symbols and
   *  colors are legible at schematic scale. Default 0 = strict 1-cell-per-stitch. */
  minCellSize?: number;
}

/**
 * Tiles a knitting chart over a schematic silhouette. Cells with a colorHex
 * are filled; when `renderSymbols` is on, cells with a symbolId are also
 * drawn (using the symbol's default color when no override is set) and the
 * symbol character is overlaid.
 *
 * Tiling anchors at the bottom of the bounds (cast-on edge in knitting),
 * with each chart copy stacking above the previous and copies repeating
 * to the right. The result is then clipped to the silhouette path so
 * cells outside the garment outline are hidden.
 *
 * `minCellSize` lets schematic callers force a readable cell size — at
 * schematic scale a single stitch is often 1–3px, which makes the chart
 * unreadable. Using a larger minimum draws the chart as a "pattern repeat"
 * preview rather than a 1:1 stitch grid.
 */
export default function ChartOverlay({
  chart,
  clipPath,
  bounds,
  stitchToPx,
  rowToPx,
  clipId,
  renderSymbols = false,
  minCellSize = 0,
}: ChartOverlayProps) {
  if (!chart) return null;
  const hasColor = chart.cells.some((c) => c?.colorHex);
  const hasSymbol = chart.cells.some((c) => c?.symbolId);
  if (!hasColor && !(renderSymbols && hasSymbol)) return null;

  const cellW = Math.max(stitchToPx, minCellSize);
  const cellH = Math.max(rowToPx, minCellSize);
  const chartW = chart.width * cellW;
  const chartH = chart.height * cellH;
  if (cellW <= 0 || cellH <= 0 || chartW <= 0 || chartH <= 0) return null;

  const fontPx = renderSymbols ? Math.max(8, Math.round(Math.min(cellW, cellH) * 0.6)) : 0;

  const nodes: ReactElement[] = [];
  let copyBottomY = bounds.y + bounds.height;
  let copyIdx = 0;
  while (copyBottomY > bounds.y) {
    const copyTopY = copyBottomY - chartH;
    let copyLeftX = bounds.x;
    while (copyLeftX < bounds.x + bounds.width) {
      for (let r = 0; r < chart.height; r++) {
        for (let c = 0; c < chart.width; c++) {
          const cell = chart.cells[r * chart.width + c];
          if (!cell) continue;
          const sym = cell.symbolId ? SYMBOL_INDEX.get(cell.symbolId) : undefined;
          const fill = cell.colorHex ?? (renderSymbols && sym ? sym.color : null);
          if (!fill && !(renderSymbols && sym)) continue;
          const x = copyLeftX + c * cellW;
          const y = copyTopY + r * cellH;
          if (fill) {
            nodes.push(
              <rect
                key={`r-${copyIdx}-${r}-${c}`}
                x={x}
                y={y}
                width={cellW}
                height={cellH}
                fill={fill}
              />,
            );
          }
          if (renderSymbols && sym?.symbol) {
            nodes.push(
              <text
                key={`s-${copyIdx}-${r}-${c}`}
                x={x + cellW / 2}
                y={y + cellH / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontPx}
                fill={fill && luminance(fill) > 0.55 ? '#111' : '#FFF'}
                style={{ pointerEvents: 'none', fontFamily: 'monospace' }}
              >
                {sym.symbol}
              </text>,
            );
          }
        }
      }
      copyLeftX += chartW;
      copyIdx++;
    }
    copyBottomY -= chartH;
  }

  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <path d={clipPath} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`} opacity={renderSymbols ? 0.9 : 0.7}>
        {nodes}
      </g>
    </g>
  );
}

function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length !== 3) return 1;
  const [r, g, b] = m.map((h) => parseInt(h, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
