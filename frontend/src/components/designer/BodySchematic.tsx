import { useId } from 'react';
import { formatLength, type BodyBlockInput, type BodyBlockOutput, type MeasurementUnit } from '../../utils/designerMath';
import type { ChartData } from './ChartGrid';
import ChartOverlay from './ChartOverlay';
import { paletteFromMainColor } from './schematicColors';

interface BodySchematicProps {
  input: BodyBlockInput;
  output: BodyBlockOutput;
  unit: MeasurementUnit;
  chart?: ChartData | null;
  /** Hex of the user's main palette color. When set, the silhouette tints
   *  to that color so the preview reads as the actual yarn. */
  mainColor?: string | null;
  /** Visual scale multiplier for the schematic. 1 = default 24rem max,
   *  2 = 48rem max, etc. Wraps in a horizontally scrollable container. */
  zoom?: number;
}

/**
 * SVG schematic for a single body panel. Renders four possible outlines
 * depending on which shaping is active:
 *   - straight rectangle (cast-on = chest, no waist, no armhole)
 *   - hourglass (waist shaping — narrows at the waist then widens to bust)
 *   - armhole-notched (top narrows to shoulder seam via a step at armhole start)
 *   - armhole-notched + neckline (front panel: scoop cut out of the top)
 *
 * Compose cleanly: any combination of the above is supported. The component
 * is pure — it reads everything from the precomputed `output` struct and
 * rerenders instantly when inputs change.
 */
export default function BodySchematic({
  input,
  output,
  unit,
  chart,
  mainColor,
  zoom = 1,
}: BodySchematicProps) {
  const clipId = useId();
  const palette = paletteFromMainColor(mainColor, {
    fill: '#F5F3FF',
    stroke: '#7C3AED',
    accent: '#DDD6FE',
  });
  const viewW = 320;
  const viewH = 420;

  const marginX = 60;
  const marginY = 40;
  const areaW = viewW - marginX * 2;
  const areaH = viewH - marginY * 2;
  const cx = viewW / 2;

  // Scale to the widest point (chest / cast-on).
  const maxStitches = output.castOnStitches;
  const stitchToPx = areaW / Math.max(1, maxStitches);

  const hasWaist = output.finishedWaist !== null && input.waist !== undefined;
  const hasArmhole =
    output.shoulderSeamStitches !== null && input.armhole !== undefined;
  const hasNeckline = hasArmhole && input.neckline !== undefined;

  // Stitch counts at each horizontal band (from bottom to top):
  //   castOn → waist? → chest → shoulderSeam (if armhole) → (neckline cut-out)
  const castOnStitches = output.castOnStitches;
  const chestStitches = castOnStitches; // same — panel width doesn't change between cast-on and chest
  const waistStitches =
    output.steps.find((s) => s.label === 'Hem to waist')?.endStitches ?? castOnStitches;
  const shoulderSeamStitches = output.shoulderSeamStitches ?? chestStitches;
  const neckOpeningStitches =
    hasNeckline && input.neckline
      ? Math.max(
          0,
          shoulderSeamStitches -
            2 * (hasArmhole && input.armhole
              ? Math.round((input.armhole.shoulderWidth * 5) / 4) // rough; overridden below
              : 0),
        )
      : 0;

  const castOnWidth = castOnStitches * stitchToPx;
  const waistWidth = waistStitches * stitchToPx;
  const chestWidth = chestStitches * stitchToPx;
  const shoulderSeamWidth = shoulderSeamStitches * stitchToPx;
  // Neck opening width: derive directly from input.neckline.neckOpeningWidth
  // × stitches/in so the geometry matches the math output.
  const neckOpeningWidth = hasNeckline && input.neckline
    ? Math.round((input.neckline.neckOpeningWidth / 4) * (output.castOnStitches / (output.finishedChest / 2)) * 4) * stitchToPx
    : 0;

  // Vertical bands (from cast-on at bottom to top).
  const bottomY = marginY + areaH;
  const topY = marginY;
  const totalRows = Math.max(1, output.totalRows);
  const rowToPx = areaH / totalRows;

  const hemY = bottomY - output.hemRows * rowToPx;
  const waistY =
    hasWaist && input.waist
      ? bottomY - rowsAt(input.waist.waistHeightFromHem, output.totalRows, output.finishedLength) * rowToPx
      : null;
  const armholeY =
    hasArmhole && input.armhole
      ? bottomY - (output.totalRows - rowsAt(input.armhole.armholeDepth, output.totalRows, output.finishedLength)) * rowToPx
      : null;
  const necklineY =
    hasNeckline && input.neckline
      ? topY + rowsAt(input.neckline.necklineDepth, output.totalRows, output.finishedLength) * rowToPx
      : null;

  // Suppress the stale "neckOpeningStitches" inline estimate from above —
  // we derive the width from input.neckline directly.
  void neckOpeningStitches;

  const half = {
    castOn: castOnWidth / 2,
    waist: waistWidth / 2,
    chest: chestWidth / 2,
    shoulderSeam: shoulderSeamWidth / 2,
    neck: neckOpeningWidth / 2,
  };

  const outline = buildPath({
    cx,
    bottomY,
    topY,
    half,
    waistY,
    armholeY,
    necklineY,
    hasWaist,
    hasArmhole,
    hasNeckline,
  });

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      role="img"
      aria-label="Body block schematic"
      className="w-full mx-auto block"
      style={{ maxWidth: `${24 * zoom}rem` }}
    >
      <path
        d={outline}
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      <ChartOverlay
        chart={chart ?? null}
        clipPath={outline}
        bounds={{ x: marginX, y: marginY, width: areaW, height: areaH }}
        stitchToPx={stitchToPx}
        rowToPx={rowToPx}
        clipId={clipId}
        renderSymbols
      />

      {/* Hem fill — slightly darker band at cast-on edge */}
      <rect
        x={cx - half.castOn}
        y={hemY}
        width={half.castOn * 2}
        height={bottomY - hemY}
        fill={palette.accent}
        opacity="0.7"
      />
      <line
        x1={cx - half.castOn}
        y1={hemY}
        x2={cx + half.castOn}
        y2={hemY}
        stroke={palette.stroke}
        strokeWidth="1"
        strokeDasharray="3 2"
      />

      {/* Armhole marker line — dashed across the body at the underarm */}
      {hasArmhole && armholeY !== null && (
        <line
          x1={cx - half.chest}
          y1={armholeY}
          x2={cx + half.chest}
          y2={armholeY}
          stroke={palette.stroke}
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      )}

      {/* Top (bind-off) stitch count — shoulder seam when armhole present */}
      <text x={cx} y={topY - 12} textAnchor="middle" className="fill-gray-700 text-[13px] font-semibold">
        ← {hasArmhole ? shoulderSeamStitches : output.steps[output.steps.length - 1].startStitches} sts
        {hasNeckline ? ' (incl. neck opening)' : ''} →
      </text>

      {/* Bottom (cast-on) stitch count */}
      <text x={cx} y={bottomY + 20} textAnchor="middle" className="fill-gray-700 text-[13px] font-semibold">
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

      {/* Armhole label */}
      {hasArmhole && armholeY !== null && (
        <text
          x={cx + half.chest + 8}
          y={armholeY + 4}
          textAnchor="start"
          className="fill-gray-600 text-[11px]"
        >
          armhole
        </text>
      )}

      {/* Finished chest label */}
      <text
        x={cx + half.chest + 8}
        y={(armholeY ?? topY) - 6}
        textAnchor="start"
        className="fill-gray-600 text-[11px]"
      >
        chest: {formatLength(output.finishedChest, unit)}
      </text>

      {/* Finished length */}
      <text
        x={viewW - 10}
        y={viewH / 2}
        textAnchor="middle"
        transform={`rotate(90 ${viewW - 10} ${viewH / 2})`}
        className="fill-gray-500 text-[11px]"
      >
        {formatLength(output.finishedLength, unit)} total
      </text>

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
// Path builder (handles all combinations of waist / armhole / neckline)
// ---------------------------------------------------------------------------

interface PathParams {
  cx: number;
  bottomY: number;
  topY: number;
  half: {
    castOn: number;
    waist: number;
    chest: number;
    shoulderSeam: number;
    neck: number;
  };
  waistY: number | null;
  armholeY: number | null;
  necklineY: number | null;
  hasWaist: boolean;
  hasArmhole: boolean;
  hasNeckline: boolean;
}

function buildPath(p: PathParams): string {
  const { cx, bottomY, topY, half, waistY, armholeY, necklineY, hasWaist, hasArmhole, hasNeckline } = p;

  // Walk counter-clockwise from bottom-left. Key points up the left side:
  //   castOn-left (bottom)
  //   waist-left (if waist)
  //   chest-left (just below armhole start, or at top if no armhole)
  //   shoulderSeam-left (armhole step, if armhole)
  //   top-left (at shoulder, continuing across top)
  //
  // Neckline (if present) carves a notch out of the top line.

  const parts: string[] = [];

  // Start at cast-on bottom-left
  parts.push(`M ${cx - half.castOn} ${bottomY}`);

  // Up left side — waist narrowing first, then chest
  if (hasWaist && waistY !== null) {
    parts.push(`L ${cx - half.waist} ${waistY}`);
  }
  // Chest line — just below the armhole (or at top if no armhole)
  if (hasArmhole && armholeY !== null) {
    parts.push(`L ${cx - half.chest} ${armholeY}`);
    // Step inward to shoulder seam at armhole Y
    parts.push(`L ${cx - half.shoulderSeam} ${armholeY}`);
    // Up the inner edge to the top
    parts.push(`L ${cx - half.shoulderSeam} ${topY}`);
  } else {
    parts.push(`L ${cx - half.chest} ${topY}`);
  }

  // Across the top — with neckline carve-out if present
  if (hasNeckline && necklineY !== null && half.neck > 0) {
    // Left shoulder flat: from shoulder seam edge inward to neck-left
    parts.push(`L ${cx - half.neck} ${topY}`);
    // Down into the neck scoop (flat-bottom U for v1)
    parts.push(`L ${cx - half.neck} ${necklineY}`);
    // Across bottom of neck
    parts.push(`L ${cx + half.neck} ${necklineY}`);
    // Back up
    parts.push(`L ${cx + half.neck} ${topY}`);
  }

  // Right shoulder / top-right (mirror of left)
  if (hasArmhole && armholeY !== null) {
    parts.push(`L ${cx + half.shoulderSeam} ${topY}`);
    parts.push(`L ${cx + half.shoulderSeam} ${armholeY}`);
    parts.push(`L ${cx + half.chest} ${armholeY}`);
  } else {
    parts.push(`L ${cx + half.chest} ${topY}`);
  }
  // Down right side
  if (hasWaist && waistY !== null) {
    parts.push(`L ${cx + half.waist} ${waistY}`);
  }
  parts.push(`L ${cx + half.castOn} ${bottomY}`);
  parts.push('Z');

  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert an inch distance along the piece into a row count via proportion. */
function rowsAt(lengthInches: number, totalRows: number, totalLength: number): number {
  if (totalLength <= 0) return 0;
  return (lengthInches / totalLength) * totalRows;
}
