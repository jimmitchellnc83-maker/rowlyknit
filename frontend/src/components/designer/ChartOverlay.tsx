import type { ReactElement } from 'react';
import { getCellSpan, renderStitchInto } from '../../data/stitchSvgLibrary';
import type { ChartData } from './ChartGrid';
import type { ChartPlacement } from '../../types/pattern';
import type { ExpandedRow } from '../../types/repeat';

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
  /**
   * Canonical chart placement (PR 8 of the Designer rebuild). When
   * supplied, drives the chart's offset, repeat mode, and stacking
   * layer. Absent → legacy bottom-left tile (back-compat).
   *
   * Honored fields:
   *   - `offset.x` shifts the chart anchor right by N stitches
   *   - `offset.y` shifts the chart anchor up by N rows
   *   - `repeatMode = 'single'` paints the chart once at the anchor with
   *     no tiling; any other value (or omitted) keeps the legacy tile.
   *   - `repeatMode = 'panel-aware'` is treated as `single` until the
   *     panel-slice pipeline reaches this layer.
   *   - `repeatMode = 'motif'` is treated as `tile` (the canonical
   *     tile-both-axes mode and the legacy bottom-left tile coincide
   *     once `expandedRows` clamps the vertical extent).
   *   - `layer` does not affect rendering today; consumers should sort
   *     overlapping `<ChartOverlay>` calls by layer themselves.
   */
  placement?: ChartPlacement | null;
  /**
   * Expanded row sequence from `expandSection` (`utils/repeatEngine.ts`).
   * When provided, the overlay paints exactly `expandedRows.length` rows
   * upward from `bounds.bottom` (offset by `placement.offset.y`) — the
   * chart no longer extends past the canonical row count even when the
   * silhouette would allow more tiling. Absent → legacy "fill bounds
   * vertically" behavior.
   */
  expandedRows?: ExpandedRow[];
}

/**
 * Tiles a knitting chart over a schematic silhouette. Multi-cell stitches
 * (cables, shells) draw as one wide artwork spanning their full cell run.
 *
 * Canonical chart layer (PR 8 of the Designer rebuild): when `placement`
 * and/or `expandedRows` are supplied, the overlay reads them as the
 * authoritative source for chart geometry. Legacy callers that pass
 * neither still get the bottom-left bottomless tile. See
 * `utils/chartOverlayFromSection.ts` for the canonical-section adapter.
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
  placement,
  expandedRows,
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

  // Canonical placement defaults preserve the legacy behavior when
  // `placement` is absent or partially specified.
  const offsetX = placement?.offset?.x ?? 0;
  const offsetY = placement?.offset?.y ?? 0;
  const repeatMode = placement?.repeatMode ?? 'tile';
  // 'single' and 'panel-aware' both render exactly one chart copy at the
  // anchor today; panel-aware will narrow to its slice when the panel
  // pipeline lands.
  const tileMode: 'tile' | 'single' = repeatMode === 'single' || repeatMode === 'panel-aware'
    ? 'single'
    : 'tile';

  // Vertical extent of the canonical row sequence. When `expandedRows`
  // is supplied, the overlay tops out at row N regardless of the
  // silhouette's height — this is what makes the chart match the
  // structured pattern model rather than just filling space.
  const verticalLimitPx = expandedRows && expandedRows.length > 0
    ? expandedRows.length * cellH
    : null;

  const nodes: ReactElement[] = [];
  // Anchor: bottom-left of the bounds, shifted by the placement offset.
  // Positive offsetY raises the anchor (chart shifted up); positive
  // offsetX shifts the anchor right.
  const anchorX = bounds.x + offsetX * cellW;
  const anchorBottom = bounds.y + bounds.height - offsetY * cellH;
  // Top of the rendered region — clamps to the bounds top in tile mode,
  // and to anchorBottom - chartH in single mode. When `expandedRows`
  // limits the vertical extent, top clamps to anchorBottom - limit.
  const tileTop = (() => {
    if (tileMode === 'single') return anchorBottom - chartH;
    if (verticalLimitPx !== null) {
      return Math.max(bounds.y, anchorBottom - verticalLimitPx);
    }
    return bounds.y;
  })();

  let copyBottomY = anchorBottom;
  let copyIdx = 0;
  while (copyBottomY > tileTop) {
    const copyTopY = copyBottomY - chartH;
    let copyLeftX = anchorX;
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
      // Single mode: only one horizontal copy at the anchor.
      if (tileMode === 'single') break;
    }
    copyBottomY -= chartH;
    // Single mode: only one vertical copy. Tile mode keeps walking up
    // until tileTop.
    if (tileMode === 'single') break;
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
