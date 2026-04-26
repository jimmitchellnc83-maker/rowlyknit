import { useId } from 'react';
import { formatLength, type CustomDraftOutput, type MeasurementUnit } from '../../utils/designerMath';
import type { ChartData } from './ChartGrid';
import ChartOverlay from './ChartOverlay';
import { paletteFromMainColor } from './schematicColors';

interface CustomDraftSchematicProps {
  output: CustomDraftOutput;
  unit: MeasurementUnit;
  chart?: ChartData | null;
  mainColor?: string | null;
  zoom?: number;
}

/**
 * Trapezoid-stack schematic for a section-based custom draft. Each
 * section becomes a trapezoid: width = stitch count at start (bottom)
 * and end (top), height = rows. Stacks bottom-up matching the knitting
 * direction — cast-on at bottom, bind-off at top.
 *
 * The combined silhouette is built once as a single SVG path so the
 * chart overlay can clip to it cleanly. Section labels float on the
 * right edge for readability.
 */
export default function CustomDraftSchematic({ output, unit, chart, mainColor, zoom = 1 }: CustomDraftSchematicProps) {
  const clipId = useId();
  const palette = paletteFromMainColor(mainColor, {
    fill: '#FAF5FF',
    stroke: '#7C3AED',
    accent: '#DDD6FE',
  });
  const viewW = 360;
  const viewH = 480;
  const marginX = 50;
  const marginY = 40;
  const areaW = viewW - marginX * 2;
  const areaH = viewH - marginY * 2;
  const cx = viewW / 2;

  if (output.sections.length === 0 || output.totalRows === 0) {
    return (
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="w-full mx-auto block"
        style={{ maxWidth: `${24 * zoom}rem` }}
        role="img"
        aria-label="Custom draft schematic (empty)"
      >
        <text x={cx} y={viewH / 2} textAnchor="middle" className="fill-gray-400 text-[12px] italic">
          Add at least one section with rows to see the schematic
        </text>
      </svg>
    );
  }

  const maxStitches = Math.max(
    1,
    output.startingStitches,
    ...output.sections.flatMap((s) => [s.startStitches, s.endStitches]),
  );

  const stitchToPx = areaW / maxStitches;
  const rowToPx = areaH / Math.max(1, output.totalRows);

  // Walk sections bottom-up, building both the outline points (left side
  // going up, then right side coming down) and per-section label data.
  const bottomY = marginY + areaH;
  const leftPoints: Array<[number, number]> = [];
  const rightPoints: Array<[number, number]> = [];
  const labels: Array<{ name: string; x: number; y: number }> = [];

  let y = bottomY;
  output.sections.forEach((section) => {
    const startW = section.startStitches * stitchToPx;
    const endW = section.endStitches * stitchToPx;
    const sectionPxH = section.rows * rowToPx;
    const topY = y - sectionPxH;

    if (leftPoints.length === 0) {
      leftPoints.push([cx - startW / 2, y]);
      rightPoints.push([cx + startW / 2, y]);
    }
    leftPoints.push([cx - endW / 2, topY]);
    rightPoints.push([cx + endW / 2, topY]);

    if (sectionPxH > 14) {
      labels.push({
        name: section.name || `Section ${section.index + 1}`,
        x: cx + Math.max(startW, endW) / 2 + 8,
        y: y - sectionPxH / 2 + 4,
      });
    }

    y = topY;
  });

  // Outline = left side bottom→top, then right side top→bottom, closed.
  const outline =
    'M ' +
    leftPoints.map(([x, py]) => `${x} ${py}`).join(' L ') +
    ' L ' +
    [...rightPoints].reverse().map(([x, py]) => `${x} ${py}`).join(' L ') +
    ' Z';

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      className="w-full mx-auto block"
      style={{ maxWidth: `${24 * zoom}rem` }}
      role="img"
      aria-label="Custom draft schematic"
    >
      <path d={outline} fill={palette.fill} stroke={palette.stroke} strokeWidth="1.5" strokeLinejoin="round" />

      <ChartOverlay
        chart={chart ?? null}
        clipPath={outline}
        bounds={{ x: marginX, y: marginY, width: areaW, height: areaH }}
        stitchToPx={stitchToPx}
        rowToPx={rowToPx}
        clipId={clipId}
        renderSymbols
        minCellSize={14}
      />

      {/* Section dividers — dashed line between sections */}
      {(() => {
        let dy = bottomY;
        return output.sections.map((section, i) => {
          const sectionPxH = section.rows * rowToPx;
          const topY = dy - sectionPxH;
          const widthAtTop = section.endStitches * stitchToPx;
          const line = (
            <line
              key={`div-${section.id}`}
              x1={cx - widthAtTop / 2}
              y1={topY}
              x2={cx + widthAtTop / 2}
              y2={topY}
              stroke={palette.stroke}
              strokeWidth="0.75"
              strokeDasharray="3 2"
              opacity={i === output.sections.length - 1 ? 0 : 0.7}
            />
          );
          dy = topY;
          return line;
        });
      })()}

      {/* Cast-on label */}
      <text x={cx} y={bottomY + 18} textAnchor="middle" className="fill-gray-700 text-[12px] font-semibold">
        ← {output.startingStitches} sts (cast on) →
      </text>

      {/* Final-stitches label at the top — only meaningful if it's > 0 */}
      {output.finalStitches > 0 && (
        <text x={cx} y={marginY - 8} textAnchor="middle" className="fill-gray-700 text-[12px] font-semibold">
          ← {output.finalStitches} sts →
        </text>
      )}

      {/* Section labels on the right edge */}
      {labels.map((label) => (
        <text
          key={`lbl-${label.x}-${label.y}`}
          x={label.x}
          y={label.y}
          textAnchor="start"
          className="fill-gray-600 text-[10px]"
        >
          {label.name}
        </text>
      ))}

      {/* Total height label rotated on right margin */}
      <text
        x={viewW - 6}
        y={viewH / 2}
        textAnchor="middle"
        transform={`rotate(90 ${viewW - 6} ${viewH / 2})`}
        className="fill-gray-500 text-[11px]"
      >
        {formatLength(output.totalHeightInches, unit)} total · {output.totalRows} rows
      </text>
    </svg>
  );
}
