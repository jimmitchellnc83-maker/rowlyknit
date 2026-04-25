import { useId } from 'react';
import { formatLength, type MeasurementUnit } from '../../utils/designerMath';
import type { ChartData } from './ChartGrid';
import ChartOverlay from './ChartOverlay';
import { customShapeToPath, type CustomShape } from '../../types/customShape';

interface CustomSchematicProps {
  shape: CustomShape;
  unit: MeasurementUnit;
  chart?: ChartData | null;
  /** Stitches per inch from gauge — used to size chart cells.
   *  Fall back to a typical fingering/sport gauge of ~5/in if absent. */
  stitchesPerInch?: number;
  /** Rows per inch from gauge — used to size chart cells.
   *  Fall back to ~7/in if absent. */
  rowsPerInch?: number;
}

/**
 * Renders a user-defined custom polygon as a schematic. Scales the shape's
 * bounding box (widthInches × heightInches) to fit the SVG viewport while
 * preserving aspect, then draws the polygon, an optional chart overlay
 * clipped to the polygon outline, and width / height labels.
 *
 * The chart cell size is derived from gauge × inches so colorwork tiles
 * at a realistic density on the schematic.
 */
export default function CustomSchematic({
  shape,
  unit,
  chart,
  stitchesPerInch = 5,
  rowsPerInch = 7,
}: CustomSchematicProps) {
  const clipId = useId();
  const viewW = 320;
  const viewH = 380;
  const marginX = 40;
  const marginY = 40;
  const areaW = viewW - marginX * 2;
  const areaH = viewH - marginY * 2;

  const w = Math.max(0.01, shape.widthInches);
  const h = Math.max(0.01, shape.heightInches);
  const aspect = w / h;
  const drawW = Math.min(areaW, areaH * aspect);
  const drawH = drawW / aspect;
  const drawX = marginX + (areaW - drawW) / 2;
  const drawY = marginY + (areaH - drawH) / 2;

  const polygonPath = customShapeToPath(shape, drawX, drawY, drawW, drawH);

  const stitchesAcross = Math.max(1, w * stitchesPerInch);
  const rowsTall = Math.max(1, h * rowsPerInch);
  const stitchToPx = drawW / stitchesAcross;
  const rowToPx = drawH / rowsTall;

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      role="img"
      aria-label="Custom shape schematic"
      className="w-full max-w-sm mx-auto"
    >
      {polygonPath ? (
        <>
          <path
            d={polygonPath}
            fill="#FAF5FF"
            stroke="#7C3AED"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <ChartOverlay
            chart={chart ?? null}
            clipPath={polygonPath}
            bounds={{ x: drawX, y: drawY, width: drawW, height: drawH }}
            stitchToPx={stitchToPx}
            rowToPx={rowToPx}
            clipId={clipId}
          />
        </>
      ) : (
        <text
          x={viewW / 2}
          y={viewH / 2}
          textAnchor="middle"
          className="fill-gray-400 text-[12px] italic"
        >
          Add at least 3 vertices to draw a shape
        </text>
      )}

      <text
        x={drawX + drawW / 2}
        y={drawY + drawH + 22}
        textAnchor="middle"
        className="fill-gray-700 text-[12px] font-semibold"
      >
        {formatLength(shape.widthInches, unit)} wide
      </text>
      <text
        x={drawX + drawW + 14}
        y={drawY + drawH / 2}
        textAnchor="middle"
        transform={`rotate(90 ${drawX + drawW + 14} ${drawY + drawH / 2})`}
        className="fill-gray-500 text-[11px]"
      >
        {formatLength(shape.heightInches, unit)} tall
      </text>
    </svg>
  );
}
