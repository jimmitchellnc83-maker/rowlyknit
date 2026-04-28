import { useId } from 'react';
import { formatLength, type MittenOutput, type MeasurementUnit } from '../../utils/designerMath';
import type { ChartData } from './ChartGrid';
import ChartOverlay from './ChartOverlay';
import { paletteFromMainColor } from './schematicColors';

interface MittenSchematicProps {
  output: MittenOutput;
  unit: MeasurementUnit;
  chart?: ChartData | null;
  mainColor?: string | null;
  zoom?: number;
}

/**
 * Flattened mitten silhouette: rounded-top rectangle for the hand with a
 * smaller rounded rectangle branching off for the thumb. Deliberately
 * schematic — proportions don't try to match hand anatomy exactly; they
 * just show which dimension lives where so the labels are legible.
 */
export default function MittenSchematic({ output, unit, chart, mainColor, zoom = 1 }: MittenSchematicProps) {
  const clipId = useId();
  const palette = paletteFromMainColor(mainColor, {
    fill: '#FEF3C7',
    stroke: '#D97706',
    accent: '#FCD34D',
  });
  const viewW = 340;
  const viewH = 380;
  const cx = viewW / 2;
  const handTop = 40;
  const handBottom = 330;
  const handHalfWidth = 60;
  const thumbLeft = cx - handHalfWidth - 30;
  const thumbTop = 180;
  const thumbBottom = 230;

  const handPath = `M ${cx - handHalfWidth} ${handBottom}
            L ${cx - handHalfWidth} ${handTop + 40}
            Q ${cx - handHalfWidth} ${handTop} ${cx} ${handTop}
            Q ${cx + handHalfWidth} ${handTop} ${cx + handHalfWidth} ${handTop + 40}
            L ${cx + handHalfWidth} ${handBottom}
            Z`;
  const thumbPath = `M ${thumbLeft} ${thumbBottom}
            L ${thumbLeft} ${thumbTop + 16}
            Q ${thumbLeft} ${thumbTop} ${thumbLeft + 20} ${thumbTop}
            Q ${cx - handHalfWidth} ${thumbTop} ${cx - handHalfWidth} ${thumbTop + 10}
            L ${cx - handHalfWidth} ${thumbBottom}
            Z`;
  // Compound path so the chart overlay clips to both hand + thumb regions.
  const mittenPath = `${handPath} ${thumbPath}`;
  // Cell size: derive from hand stitch count if available, else use a
  // reasonable default that tiles a 10×10 chart a few times across the hand.
  const stitchToPx =
    output.handStitches > 0 ? (handHalfWidth * 2) / output.handStitches : 4;
  const rowToPx = stitchToPx;

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} role="img" aria-label="Mitten schematic" className="w-full mx-auto block" style={{ maxWidth: `${24 * zoom}rem` }}>
      {/* Hand: rounded-top rect */}
      <path
        d={handPath}
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.5"
      />
      {/* Thumb: smaller rounded rect off to the left */}
      <path
        d={thumbPath}
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.5"
      />

      <ChartOverlay
        chart={chart ?? null}
        clipPath={mittenPath}
        bounds={{ x: thumbLeft, y: handTop, width: cx + handHalfWidth - thumbLeft, height: handBottom - handTop }}
        stitchToPx={stitchToPx}
        rowToPx={rowToPx}
        clipId={clipId}
        renderSymbols
      />

      {/* Cuff dashed band at bottom */}
      <line
        x1={cx - handHalfWidth}
        y1={handBottom - 40}
        x2={cx + handHalfWidth}
        y2={handBottom - 40}
        stroke={palette.stroke}
        strokeDasharray="3 2"
        strokeWidth="1"
      />

      {/* Labels */}
      <text x={cx} y={handBottom + 18} textAnchor="middle" className="fill-gray-700 text-[12px] font-semibold">
        cuff: {output.castOnStitches} sts
      </text>
      <text x={cx} y={handTop - 8} textAnchor="middle" className="fill-gray-700 text-[11px]">
        top: ~8 sts (closed)
      </text>
      <text x={thumbLeft + 10} y={thumbTop - 6} textAnchor="middle" className="fill-gray-600 text-[10px]">
        thumb: {output.thumbStitches} sts
      </text>

      <text x={cx + handHalfWidth + 8} y={handTop + 20} textAnchor="start" className="fill-gray-500 text-[11px]">
        hand: {formatLength(output.finishedHandCircumference, unit)}
      </text>
      <text x={cx + handHalfWidth + 8} y={handBottom + 4} textAnchor="start" className="fill-gray-500 text-[11px]">
        total: {formatLength(output.finishedLength, unit)}
      </text>
    </svg>
  );
}
