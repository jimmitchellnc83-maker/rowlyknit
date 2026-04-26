import type { ReactElement } from 'react';
import { getCellSpan, renderStitchInto } from '../../data/stitchSvgLibrary';
import type { ChartData } from './ChartGrid';

interface ChartOverlayProps {
  chart: ChartData | null;
  /** SVG path string defining the silhouette to clip the overlay to. */
  clipPath: string;
  /** Bounding rectangle of the area to tile chart cells within. */
  bounds: { x: number; y: number; width: number; height: number };
  /** Pixel size of one stitch (chart cell width). */
  stitchToPx: number;
  /** Pixel size of one knitted row (chart cell height). */
  rowToPx: number;
  /** Unique id for the clipPath element (must be unique within the page). */
  clipId: string;
  /** When true, draws the symbol artwork on top of the color fills. Default
   *  false preserves the legacy color-only overlay used by tests. */
  renderSymbols?: boolean;
  /** Minimum cell edge length in pixels. */
  minCellSize?: number;
}

/**
 * Tiles a knitting chart over a schematic silhouette. Multi-cell stitches
 * (cables, shells) draw as one wide artwork spanning their full cell run.
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

  const nodes: ReactElement[] = [];
  let copyBottomY = bounds.y + bounds.height;
  let copyIdx = 0;
  while (copyBottomY > bounds.y) {
    const copyTopY = copyBottomY - chartH;
    let copyLeftX = bounds.x;
    while (copyLeftX < bounds.x + bounds.width) {
      // Color fills first — every cell with a colorHex paints a rect.
      // When renderSymbols is on, also fill a white rect for symbol-only
      // cells so the stitch artwork has a background to sit on against the
      // schematic silhouette.
      for (let r = 0; r < chart.height; r++) {
        for (let c = 0; c < chart.width; c++) {
          const cell = chart.cells[r * chart.width + c];
          if (!cell) continue;
          const fill = cell.colorHex ?? (renderSymbols && cell.symbolId ? '#FFFFFF' : null);
          if (!fill) continue;
          nodes.push(
            <rect
              key={`r-${copyIdx}-${r}-${c}`}
              x={copyLeftX + c * cellW}
              y={copyTopY + r * cellH}
              width={cellW}
              height={cellH}
              fill={fill}
            />,
          );
        }
      }
      // Symbol overlay — walk runs per row, draw each leader once.
      if (renderSymbols) {
        for (let r = 0; r < chart.height; r++) {
          let c = 0;
          while (c < chart.width) {
            const cell = chart.cells[r * chart.width + c];
            const sym = cell?.symbolId ?? null;
            if (!sym) {
              c++;
              continue;
            }
            let runLen = 1;
            while (
              c + runLen < chart.width &&
              chart.cells[r * chart.width + c + runLen]?.symbolId === sym
            ) {
              runLen++;
            }
            const span = getCellSpan(sym, 1);
            let consumed = 0;
            while (consumed < runLen) {
              const drawSpan = Math.min(span, runLen - consumed);
              const leaderC = c + consumed;
              const fill = cell?.colorHex ?? '#FFFFFF';
              const stroke = luminance(fill) > 0.55 ? '#111111' : '#FFFFFF';
              const node = renderStitchInto({
                id: sym,
                x: copyLeftX + leaderC * cellW,
                y: copyTopY + r * cellH,
                width: drawSpan * cellW,
                height: cellH,
                stroke,
                keyPrefix: `s-${copyIdx}-${r}-${leaderC}`,
              });
              if (node) nodes.push(node);
              consumed += drawSpan;
            }
            c += runLen;
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
