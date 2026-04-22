import type { HatOutput } from '../../utils/designerMath';

interface HatSchematicProps {
  output: HatOutput;
}

/**
 * Minimal SVG schematic for a beanie. A flattened pentagon — rectangle
 * bottom (body + brim) with a triangular top representing the crown
 * decreases tapering to the closed point. Brim is shaded as a band at the
 * cast-on edge.
 */
export default function HatSchematic({ output }: HatSchematicProps) {
  const viewW = 320;
  const viewH = 380;
  const marginX = 60;
  const marginY = 32;
  const areaW = viewW - marginX * 2;
  const areaH = viewH - marginY * 2;
  const cx = viewW / 2;

  const stitchToPx = areaW / Math.max(1, output.castOnStitches);
  const width = output.castOnStitches * stitchToPx;
  const halfWidth = width / 2;

  const totalRows = Math.max(1, output.brimRows + output.bodyRows + output.crownRows + 1);
  const rowToPx = areaH / totalRows;

  const bottomY = marginY + areaH;
  const brimTopY = bottomY - output.brimRows * rowToPx;
  const crownStartY = brimTopY - output.bodyRows * rowToPx;
  const peakY = marginY;

  // Pentagon: straight sides from cast-on to crown start, triangular taper
  // from each top corner in to the centered peak (closed crown).
  const outline = [
    `M ${cx - halfWidth} ${bottomY}`,
    `L ${cx - halfWidth} ${crownStartY}`,
    `L ${cx} ${peakY}`,
    `L ${cx + halfWidth} ${crownStartY}`,
    `L ${cx + halfWidth} ${bottomY}`,
    'Z',
  ].join(' ');

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      role="img"
      aria-label="Hat schematic"
      className="w-full max-w-sm mx-auto"
    >
      <path d={outline} fill="#EFF6FF" stroke="#2563EB" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Brim band */}
      <rect
        x={cx - halfWidth}
        y={brimTopY}
        width={width}
        height={bottomY - brimTopY}
        fill="#BFDBFE"
        opacity="0.55"
      />
      <line
        x1={cx - halfWidth}
        y1={brimTopY}
        x2={cx + halfWidth}
        y2={brimTopY}
        stroke="#2563EB"
        strokeWidth="1"
        strokeDasharray="3 2"
      />

      {/* Crown-start dashed line */}
      <line
        x1={cx - halfWidth}
        y1={crownStartY}
        x2={cx + halfWidth}
        y2={crownStartY}
        stroke="#60A5FA"
        strokeWidth="1"
        strokeDasharray="2 3"
      />

      {/* Cast-on label */}
      <text
        x={cx}
        y={bottomY + 20}
        textAnchor="middle"
        className="fill-gray-700 text-[13px] font-semibold"
      >
        ← {output.castOnStitches} sts (cast on in the round) →
      </text>

      {/* Peak label */}
      <text
        x={cx}
        y={peakY - 10}
        textAnchor="middle"
        className="fill-gray-700 text-[12px] font-semibold"
      >
        Close {output.crownEndStitches} sts
      </text>

      {/* Circumference right */}
      <text
        x={cx + halfWidth + 8}
        y={(brimTopY + crownStartY) / 2 + 4}
        textAnchor="start"
        className="fill-gray-600 text-[11px]"
      >
        circ: {output.finishedCircumference} in
      </text>

      {/* Brim label */}
      <text
        x={marginX - 8}
        y={(brimTopY + bottomY) / 2 + 4}
        textAnchor="end"
        className="fill-gray-500 text-[10px]"
      >
        brim
      </text>

      {/* Crown label */}
      <text
        x={marginX - 8}
        y={(crownStartY + peakY) / 2 + 4}
        textAnchor="end"
        className="fill-gray-500 text-[10px]"
      >
        crown
      </text>

      {/* Total height right (rotated) */}
      <text
        x={viewW - 10}
        y={viewH / 2}
        textAnchor="middle"
        transform={`rotate(90 ${viewW - 10} ${viewH / 2})`}
        className="fill-gray-500 text-[11px]"
      >
        {output.finishedHeight} in total
      </text>
    </svg>
  );
}
