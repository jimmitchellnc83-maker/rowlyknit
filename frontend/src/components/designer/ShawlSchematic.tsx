import type { ShawlOutput } from '../../utils/designerMath';

interface ShawlSchematicProps {
  output: ShawlOutput;
}

/**
 * Isosceles triangle schematic for a top-down shawl. Apex at top (center
 * back neck), wingspan across the bottom, depth = height of the triangle.
 * Because our shawl construction is always a right-angled top-down triangle
 * with ~4 sts added per RS row, depth ends up roughly wingspan/4 at standard
 * gauge — we render whatever ratio the math produced rather than forcing a
 * specific shape.
 */
export default function ShawlSchematic({ output }: ShawlSchematicProps) {
  const viewW = 340;
  const viewH = 300;
  const marginX = 40;
  const marginY = 40;
  const areaW = viewW - marginX * 2;
  const areaH = viewH - marginY * 2;
  const cx = viewW / 2;

  // Scale so the wider of wingspan / depth uses the full drawable area.
  const scale = Math.min(
    areaW / Math.max(0.01, output.finishedWingspan),
    areaH / Math.max(0.01, output.finishedDepth),
  );
  const width = output.finishedWingspan * scale;
  const depth = output.finishedDepth * scale;

  const topY = marginY + (areaH - depth) / 2;
  const bottomY = topY + depth;
  const leftX = cx - width / 2;
  const rightX = cx + width / 2;

  const outline = [
    `M ${cx} ${topY}`, // apex (center top)
    `L ${leftX} ${bottomY}`,
    `L ${rightX} ${bottomY}`,
    'Z',
  ].join(' ');

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      role="img"
      aria-label="Shawl schematic"
      className="w-full max-w-sm mx-auto"
    >
      <path d={outline} fill="#FDF2F8" stroke="#DB2777" strokeWidth="1.5" strokeLinejoin="round" />

      {/* Center spine marker */}
      <line
        x1={cx}
        y1={topY}
        x2={cx}
        y2={bottomY}
        stroke="#DB2777"
        strokeWidth="0.75"
        strokeDasharray="3 3"
        opacity="0.6"
      />

      {/* Apex dot + cast-on label */}
      <circle cx={cx} cy={topY} r="3" fill="#DB2777" />
      <text x={cx} y={topY - 12} textAnchor="middle" className="fill-gray-700 text-[12px] font-semibold">
        cast on {output.castOnStitches} sts
      </text>

      {/* Wingspan label across the bottom */}
      <text x={cx} y={bottomY + 18} textAnchor="middle" className="fill-gray-700 text-[13px] font-semibold">
        ← {output.finishedWingspan} in wingspan · {output.finalStitches} sts →
      </text>

      {/* Depth label on right */}
      <text
        x={rightX + 10}
        y={(topY + bottomY) / 2}
        textAnchor="middle"
        transform={`rotate(90 ${rightX + 10} ${(topY + bottomY) / 2})`}
        className="fill-gray-500 text-[11px]"
      >
        depth: {output.finishedDepth} in
      </text>
    </svg>
  );
}
