import { formatLength, type SleeveInput, type SleeveOutput, type MeasurementUnit } from '../../utils/designerMath';

interface SleeveSchematicProps {
  input: SleeveInput;
  output: SleeveOutput;
  unit: MeasurementUnit;
}

/**
 * Trapezoid schematic for a single sleeve with an optional set-in cap.
 *
 * Without cap: cuff (narrow) → bicep (widest). Flat top.
 * With cap: cuff → bicep → initial underarm bind-off (steps inward) → cap
 * taper (narrows) → cap top (narrow bind-off). The whole outline becomes an
 * elongated hexagon with a clear "shoulder-ball" silhouette at the top.
 */
export default function SleeveSchematic({ input: _input, output, unit }: SleeveSchematicProps) {
  const viewW = 320;
  const viewH = 440;

  const marginX = 60;
  const marginY = 40;
  const areaW = viewW - marginX * 2;
  const areaH = viewH - marginY * 2;
  const cx = viewW / 2;

  const hasCap = output.capTopStitches !== null;
  // Scale to the widest point — bicep is always widest for our tapered sleeve.
  const maxStitches = Math.max(output.bicepStitches, output.castOnStitches);
  const stitchToPx = areaW / Math.max(1, maxStitches);

  const bicepWidth = output.bicepStitches * stitchToPx;
  const cuffWidth = output.castOnStitches * stitchToPx;
  const capTopWidth = hasCap ? output.capTopStitches! * stitchToPx : 0;

  // Vertical scale: totalRows spans cuff + taper + optional cap.
  const totalRows = Math.max(1, output.totalRows);
  const bottomY = marginY + areaH;
  const topY = marginY;
  const rowToPx = areaH / totalRows;

  const cuffBandY = bottomY - output.cuffRows * rowToPx;

  // When a cap is present, the underarm line sits at the bicep, and the cap
  // rises from underarmY to topY. Derive underarmY from the finished-length
  // ratio so we don't need to re-read the step rows.
  const underarmY = hasCap
    ? bottomY -
      (areaH * (output.finishedLength / Math.max(output.finishedTotalLength, 0.01)))
    : topY;

  const halfBicep = bicepWidth / 2;
  const halfCuff = cuffWidth / 2;
  const halfCapTop = capTopWidth / 2;

  // Build outline walking counter-clockwise from bottom-left.
  const outline = hasCap
    ? [
        `M ${cx - halfCuff} ${bottomY}`, // cuff bottom-left
        `L ${cx - halfBicep} ${underarmY}`, // up left taper to bicep
        `L ${cx - halfCapTop} ${topY}`, // left cap side narrows to capTop
        `L ${cx + halfCapTop} ${topY}`, // across cap top
        `L ${cx + halfBicep} ${underarmY}`, // down right cap side
        `L ${cx + halfCuff} ${bottomY}`, // down right taper to cuff
        'Z',
      ].join(' ')
    : [
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

      {/* Underarm line — only when cap present, visually separates bicep section from cap */}
      {hasCap && (
        <line
          x1={cx - halfBicep}
          y1={underarmY}
          x2={cx + halfBicep}
          y2={underarmY}
          stroke="#10B981"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      )}

      {/* Top stitch count — cap top if cap, bicep otherwise */}
      <text x={cx} y={topY - 12} textAnchor="middle" className="fill-gray-700 text-[13px] font-semibold">
        {hasCap
          ? `← ${output.capTopStitches} sts (cap top) →`
          : `← ${output.bicepStitches} sts (underarm) →`}
      </text>

      {/* Bicep label — mid-piece when cap present, top-right when not */}
      {hasCap ? (
        <text
          x={cx + halfBicep + 8}
          y={underarmY + 4}
          textAnchor="start"
          className="fill-gray-600 text-[11px]"
        >
          bicep: {formatLength(output.finishedBicep, unit)} ({output.bicepStitches} sts)
        </text>
      ) : (
        <text
          x={cx + halfBicep + 8}
          y={topY + 4}
          textAnchor="start"
          className="fill-gray-600 text-[11px]"
        >
          bicep: {formatLength(output.finishedBicep, unit)}
        </text>
      )}

      {/* Bottom stitch count (cuff cast-on) */}
      <text x={cx} y={bottomY + 20} textAnchor="middle" className="fill-gray-700 text-[13px] font-semibold">
        ← {output.castOnStitches} sts (cast on) →
      </text>

      {/* Finished cuff label (left side) */}
      <text
        x={cx - halfCuff - 8}
        y={bottomY + 4}
        textAnchor="end"
        className="fill-gray-600 text-[11px]"
      >
        cuff: {formatLength(output.finishedCuff, unit)}
      </text>

      {/* Length label (right, rotated) */}
      <text
        x={viewW - 10}
        y={viewH / 2}
        textAnchor="middle"
        transform={`rotate(90 ${viewW - 10} ${viewH / 2})`}
        className="fill-gray-500 text-[11px]"
      >
        {hasCap
          ? `${formatLength(output.finishedTotalLength, unit)} total (incl. cap)`
          : `${formatLength(output.finishedLength, unit)} to underarm`}
      </text>
    </svg>
  );
}
