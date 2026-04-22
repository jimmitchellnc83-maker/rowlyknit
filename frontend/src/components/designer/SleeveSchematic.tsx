import type { SleeveInput, SleeveOutput } from '../../utils/designerMath';

interface SleeveSchematicProps {
  input: SleeveInput;
  output: SleeveOutput;
}

/**
 * Trapezoid schematic for a single sleeve. Renders a narrow base (cuff) that
 * widens to the bicep at the top, with a dashed line marking the cuff
 * ribbing band. No cap — the top edge is the underarm join point. When the
 * yoke PR ships we'll add cap shaping above this outline.
 */
export default function SleeveSchematic({ input: _input, output }: SleeveSchematicProps) {
  const viewW = 320;
  const viewH = 420;

  const marginX = 60;
  const marginY = 40;
  const areaW = viewW - marginX * 2;
  const areaH = viewH - marginY * 2;
  const cx = viewW / 2;

  // Bicep is the widest point — scale the full trapezoid by it.
  const stitchToPx = areaW / Math.max(output.bicepStitches, output.castOnStitches);

  const bicepWidth = output.bicepStitches * stitchToPx;
  const cuffWidth = output.castOnStitches * stitchToPx;

  const topY = marginY;
  const bottomY = marginY + areaH;
  const cuffRows = output.cuffRows;
  const totalRows = Math.max(1, output.totalRows);
  const cuffBandY = bottomY - (cuffRows / totalRows) * areaH;

  const halfBicep = bicepWidth / 2;
  const halfCuff = cuffWidth / 2;

  const outline = [
    `M ${cx - halfCuff} ${bottomY}`,
    `L ${cx - halfBicep} ${topY}`,
    `L ${cx + halfBicep} ${topY}`,
    `L ${cx + halfCuff} ${bottomY}`,
    'Z',
  ].join(' ');

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      role="img"
      aria-label="Sleeve schematic"
      className="w-full max-w-sm mx-auto"
    >
      <path d={outline} fill="#ECFDF5" stroke="#059669" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Cuff band (dashed line at top of ribbing) */}
      <line
        x1={cx - halfCuff - stitchToPx * 0.5}
        y1={cuffBandY}
        x2={cx + halfCuff + stitchToPx * 0.5}
        y2={cuffBandY}
        stroke="#059669"
        strokeWidth="1"
        strokeDasharray="3 2"
      />

      {/* Top stitch count (bicep, at underarm) */}
      <text x={cx} y={topY - 12} textAnchor="middle" className="fill-gray-700 text-[13px] font-semibold">
        ← {output.bicepStitches} sts (underarm) →
      </text>

      {/* Bottom stitch count (cuff cast-on) */}
      <text x={cx} y={bottomY + 20} textAnchor="middle" className="fill-gray-700 text-[13px] font-semibold">
        ← {output.castOnStitches} sts (cast on) →
      </text>

      {/* Finished bicep label (right side) */}
      <text
        x={cx + halfBicep + 8}
        y={topY + 4}
        textAnchor="start"
        className="fill-gray-600 text-[11px]"
      >
        bicep: {output.finishedBicep} in
      </text>

      {/* Finished cuff label (left side) */}
      <text
        x={cx - halfCuff - 8}
        y={bottomY + 4}
        textAnchor="end"
        className="fill-gray-600 text-[11px]"
      >
        cuff: {output.finishedCuff} in
      </text>

      {/* Length label (right, rotated) */}
      <text
        x={viewW - 10}
        y={viewH / 2}
        textAnchor="middle"
        transform={`rotate(90 ${viewW - 10} ${viewH / 2})`}
        className="fill-gray-500 text-[11px]"
      >
        {output.finishedLength} in to underarm
      </text>
    </svg>
  );
}
