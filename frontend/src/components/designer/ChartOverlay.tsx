import type { ReactElement } from 'react';
import type { ChartData } from './ChartGrid';

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
}

/**
 * Tiles the colored cells of a knitting chart over a schematic silhouette.
 * Renders only cells with `colorHex` set — symbol-only cells are too small
 * to be legible at schematic scale and are skipped.
 *
 * Tiling anchors at the bottom of the bounds (cast-on edge in knitting),
 * with each chart copy stacking above the previous and copies repeating
 * to the right. The result is then clipped to the silhouette path so
 * cells outside the garment outline are hidden.
 *
 * Returns null when there's nothing to draw (no chart, no colored cells,
 * or zero-size cells), so the schematic stays clean for users who haven't
 * painted any colorwork yet.
 */
export default function ChartOverlay({
  chart,
  clipPath,
  bounds,
  stitchToPx,
  rowToPx,
  clipId,
}: ChartOverlayProps) {
  if (!chart) return null;
  const hasColor = chart.cells.some((c) => c?.colorHex);
  if (!hasColor) return null;

  const cellW = stitchToPx;
  const cellH = rowToPx;
  const chartW = chart.width * cellW;
  const chartH = chart.height * cellH;
  if (cellW <= 0 || cellH <= 0 || chartW <= 0 || chartH <= 0) return null;

  const rects: ReactElement[] = [];
  let copyBottomY = bounds.y + bounds.height;
  while (copyBottomY > bounds.y) {
    const copyTopY = copyBottomY - chartH;
    let copyLeftX = bounds.x;
    while (copyLeftX < bounds.x + bounds.width) {
      for (let r = 0; r < chart.height; r++) {
        for (let c = 0; c < chart.width; c++) {
          const cell = chart.cells[r * chart.width + c];
          if (!cell?.colorHex) continue;
          rects.push(
            <rect
              key={`${copyLeftX}-${copyTopY}-${r}-${c}`}
              x={copyLeftX + c * cellW}
              y={copyTopY + r * cellH}
              width={cellW}
              height={cellH}
              fill={cell.colorHex}
            />,
          );
        }
      }
      copyLeftX += chartW;
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
      <g clipPath={`url(#${clipId})`} opacity="0.7">
        {rects}
      </g>
    </g>
  );
}
