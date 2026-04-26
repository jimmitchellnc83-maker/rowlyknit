/**
 * Per-color yardage estimate for a Designer draft.
 *
 * `estimateYardageFromArea` gives the total range for the finished piece.
 * This module splits that total across the colors actually painted on
 * the chart: a fair-isle pullover whose chart is 30% CC reads as
 *   MC: 0.70 × total
 *   CC: 0.30 × total
 *
 * Cells with no explicit colorHex (blank or symbol-only) count toward
 * the main color (`colors[0]`), which matches knitter intent — empty
 * chart cells are conventionally "the background, in MC."
 *
 * Limitations:
 *   - Assumes the chart's color distribution repeats across the whole
 *     piece. Locally-placed motifs (yoke band, single sleeve stripe)
 *     overshoot the colorwork yardage.
 *   - Doesn't try to model floats, strand-tension, or "plain rows
 *     above/below the chart" — buy 10–15% extra for stranded work.
 */

import type { ChartData } from '../components/designer/ChartGrid';
import type { ColorSwatch } from '../components/designer/ColorPalette';
import { estimateYardageFromArea, type YardageRange } from './yardageEstimate';
import type { DesignerGauge } from './designerMath';

export interface PerColorYardage {
  /** Hex of the color this row covers (matches `ColorSwatch.hex`). */
  hex: string;
  /** Display label (from the user's palette, or "(unlabeled)"). */
  label: string;
  /** True for the main-color row (palette index 0 / blanks). */
  isMain: boolean;
  /** Fraction of the chart this color claims (0–1). */
  fraction: number;
  /** Yardage range proportional to fraction × total yardage. */
  yardage: YardageRange;
}

export interface PerColorYardageBundle {
  /** Combined total — equals `estimateYardageFromArea(area, gauge)`. */
  total: YardageRange;
  rows: PerColorYardage[];
}

/**
 * Compute a per-color yardage breakdown for a draft.
 *
 * @param finishedAreaSqIn  Finished piece area in square inches (use the
 *                          same value you pass to `estimateYardageFromArea`).
 * @param gauge             Designer gauge (stitches × rows per 4 in).
 * @param chart             The chart whose color distribution drives the
 *                          breakdown. Pass `null` for a no-chart draft —
 *                          the result lists 100 % MC.
 * @param palette           The user's color palette. Used for labels +
 *                          the MC default. Empty palette = "(MC)".
 */
export function estimatePerColorYardage(
  finishedAreaSqIn: number,
  gauge: DesignerGauge,
  chart: ChartData | null,
  palette: ColorSwatch[],
): PerColorYardageBundle {
  const total = estimateYardageFromArea(finishedAreaSqIn, gauge);
  const mcSwatch = palette[0];
  const mcHex = mcSwatch?.hex.toLowerCase() ?? '__mc__';
  const mcLabel = mcSwatch?.label ?? 'Main color';

  // Count cells per color (lowercased hex). Cells with no explicit
  // colorHex go to MC — same convention as the print-view colors strip.
  const counts = new Map<string, number>();
  let totalCells = 0;
  if (chart) {
    for (const cell of chart.cells) {
      const hex = cell.colorHex ? cell.colorHex.toLowerCase() : mcHex;
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
      totalCells += 1;
    }
  }

  // No chart, or empty chart → 100 % MC.
  if (totalCells === 0) {
    return {
      total,
      rows: [
        {
          hex: mcSwatch?.hex ?? '#FFFFFF',
          label: mcLabel,
          isMain: true,
          fraction: 1,
          yardage: total,
        },
      ],
    };
  }

  // Build a label index so we can show "Forest" instead of "#3E5D3A" for
  // colors the user named in their palette.
  const labelByHex = new Map<string, string>();
  for (const c of palette) labelByHex.set(c.hex.toLowerCase(), c.label);

  // Stable order: MC first, then by descending fraction.
  const rows: PerColorYardage[] = [];
  const mcCount = counts.get(mcHex) ?? 0;
  if (mcCount > 0 || palette.length > 0) {
    rows.push({
      hex: mcSwatch?.hex ?? '#FFFFFF',
      label: mcLabel,
      isMain: true,
      fraction: mcCount / totalCells,
      yardage: scaleRange(total, mcCount / totalCells),
    });
  }
  for (const [hex, count] of counts) {
    if (hex === mcHex) continue;
    const fraction = count / totalCells;
    rows.push({
      hex,
      label: labelByHex.get(hex) ?? hex.toUpperCase(),
      isMain: false,
      fraction,
      yardage: scaleRange(total, fraction),
    });
  }
  rows.sort((a, b) => {
    if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
    return b.fraction - a.fraction;
  });

  return { total, rows };
}

function scaleRange(r: YardageRange, factor: number): YardageRange {
  return {
    minYds: Math.max(0, Math.round(r.minYds * factor)),
    maxYds: Math.max(0, Math.round(r.maxYds * factor)),
  };
}
