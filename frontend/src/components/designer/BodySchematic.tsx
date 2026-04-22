import type { BodyBlockInput, BodyBlockOutput } from '../../utils/designerMath';

interface BodySchematicProps {
  input: BodyBlockInput;
  output: BodyBlockOutput;
}

/**
 * Simple SVG schematic for a single body panel (front or back). Draws a
 * hourglass outline when waist shaping is present, a rectangle otherwise,
 * and labels stitch counts at each seam transition plus the finished
 * width/length outside the piece.
 *
 * Deliberately minimalist: no colorized zones, no gauge swatch overlay, no
 * shaping tick marks. Those can layer in once the basic rendering feels
 * right. The component is pure — no state, reads from the precomputed
 * `output` — so it rerenders instantly as the user tweaks inputs.
 */
export default function BodySchematic({ input, output }: BodySchematicProps) {
  const viewW = 320;
  const viewH = 420;

  // Drawable area, leaving margins for outside labels.
  const marginX = 60;
  const marginY = 40;
  const areaW = viewW - marginX * 2;
  const areaH = viewH - marginY * 2;
  const cx = viewW / 2;

  // Stitch → x-width scale, based on the widest point (chest) so the chest
  // line touches the drawable area edges.
  const maxStitches = output.castOnStitches;
  const stitchToPx = areaW / maxStitches;

  const castOnWidth = output.castOnStitches * stitchToPx;
  const chestWidth = castOnWidth; // same — both use chest panel sizing
  const hasWaist = output.finishedWaist !== null && input.waist !== undefined;
  // When shaped, the "waist" step gives us the waist stitch count.
  const waistStep = output.steps.find((s) => s.label === 'Hem to waist');
  const waistStitches = waistStep ? waistStep.endStitches : output.castOnStitches;
  const waistWidth = waistStitches * stitchToPx;

  // Y positions (0 = top of piece, higher = further toward cast-on edge at
  // the bottom of the SVG).
  const topY = marginY;
  const bottomY = marginY + areaH;

  // Row-to-Y scale (from cast-on at bottom to bind-off at top).
  const rowToPx = areaH / Math.max(1, output.totalRows);

  // Waist Y: input.waist.waistHeightFromHem is measured from cast-on edge up.
  const waistY = hasWaist && input.waist
    ? bottomY - rowsAtLength(input.waist.waistHeightFromHem, output.totalRows, output.finishedLength) * rowToPx
    : null;

  // Hem Y (top of hem, above which the body shaping starts).
  const hemY = bottomY - output.hemRows * rowToPx;

  // Build the outline path. Coordinates are all x-from-center then computed
  // via cx ± half-width.
  const half = {
    castOn: castOnWidth / 2,
    waist: waistWidth / 2,
    chest: chestWidth / 2,
  };

  const outline =
    hasWaist && waistY !== null
      ? buildWaistPath(cx, half, topY, hemY, waistY, bottomY)
      : buildRectPath(cx, half.castOn, topY, bottomY);

  // Inch labels — finishedChest is full-body circumference-with-ease; the
  // panel itself is half of that, but knitters mostly want to see the
  // finished garment width in the schematic so we keep the circumference number.

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      role="img"
      aria-label="Body block schematic"
      className="w-full max-w-sm mx-auto"
    >
      {/* Outline */}
      <path
        d={outline}
        fill="#F5F3FF"
        stroke="#7C3AED"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Hem fill — slightly darker */}
      <rect
        x={cx - half.castOn}
        y={hemY}
        width={half.castOn * 2}
        height={bottomY - hemY}
        fill="#DDD6FE"
        opacity="0.6"
      />
      <line
        x1={cx - half.castOn}
        y1={hemY}
        x2={cx + half.castOn}
        y2={hemY}
        stroke="#7C3AED"
        strokeWidth="1"
        strokeDasharray="3 2"
      />

      {/* Top (bind-off) stitch count */}
      <text x={cx} y={topY - 12} textAnchor="middle" className="fill-gray-700 text-[13px] font-semibold">
        ← {output.steps[output.steps.length - 1].startStitches} sts (bind off) →
      </text>

      {/* Bottom (cast-on) stitch count */}
      <text
        x={cx}
        y={bottomY + 20}
        textAnchor="middle"
        className="fill-gray-700 text-[13px] font-semibold"
      >
        ← {output.castOnStitches} sts (cast on) →
      </text>

      {/* Waist label */}
      {hasWaist && waistY !== null && (
        <>
          <line
            x1={cx - half.castOn - 4}
            y1={waistY}
            x2={cx - half.waist}
            y2={waistY}
            stroke="#9CA3AF"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <text
            x={cx - half.castOn - 8}
            y={waistY + 4}
            textAnchor="end"
            className="fill-gray-600 text-[11px]"
          >
            waist: {waistStitches} sts
          </text>
        </>
      )}

      {/* Finished chest label — right side, middle */}
      <text
        x={cx + half.chest + 8}
        y={(topY + (waistY ?? hemY)) / 2 + 4}
        textAnchor="start"
        className="fill-gray-600 text-[11px]"
      >
        chest: {output.finishedChest} in
      </text>

      {/* Finished length label — vertical, right-most */}
      <text
        x={viewW - 10}
        y={viewH / 2}
        textAnchor="middle"
        transform={`rotate(90 ${viewW - 10} ${viewH / 2})`}
        className="fill-gray-500 text-[11px]"
      >
        {output.finishedLength} in total
      </text>

      {/* Hem depth label — bottom-left */}
      <text
        x={marginX - 8}
        y={(hemY + bottomY) / 2 + 4}
        textAnchor="end"
        className="fill-gray-500 text-[10px]"
      >
        hem
      </text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Path builders
// ---------------------------------------------------------------------------

function buildRectPath(cx: number, halfWidth: number, topY: number, bottomY: number): string {
  const left = cx - halfWidth;
  const right = cx + halfWidth;
  return `M ${left} ${bottomY} L ${left} ${topY} L ${right} ${topY} L ${right} ${bottomY} Z`;
}

function buildWaistPath(
  cx: number,
  half: { castOn: number; waist: number; chest: number },
  topY: number,
  _hemY: number,
  waistY: number,
  bottomY: number,
): string {
  // Walk the outline counter-clockwise from bottom-left: up-left edge with
  // waist narrowing, across top, down-right edge with the mirror narrowing.
  const bottomLeft = cx - half.castOn;
  const bottomRight = cx + half.castOn;
  const topLeft = cx - half.chest;
  const topRight = cx + half.chest;
  const waistLeft = cx - half.waist;
  const waistRight = cx + half.waist;

  return [
    `M ${bottomLeft} ${bottomY}`,
    `L ${waistLeft} ${waistY}`,
    `L ${topLeft} ${topY}`,
    `L ${topRight} ${topY}`,
    `L ${waistRight} ${waistY}`,
    `L ${bottomRight} ${bottomY}`,
    'Z',
  ].join(' ');
}

function rowsAtLength(lengthInches: number, totalRows: number, totalLength: number): number {
  if (totalLength <= 0) return 0;
  return (lengthInches / totalLength) * totalRows;
}
