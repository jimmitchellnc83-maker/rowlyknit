import { formatLength, type SockOutput, type MeasurementUnit } from '../../utils/designerMath';

interface SockSchematicProps {
  output: SockOutput;
  unit: MeasurementUnit;
}

/**
 * L-shaped sock silhouette: vertical leg tube + horizontal foot tube joined
 * by a heel corner. Key stitch-count labels placed at cuff, heel, and toe.
 */
export default function SockSchematic({ output, unit }: SockSchematicProps) {
  const viewW = 340;
  const viewH = 340;

  // Leg tube
  const legLeft = 80;
  const legRight = 130;
  const legTop = 30;
  const legBottom = 190;

  // Foot tube (goes off to the right from the heel corner)
  const footLeft = legLeft;
  const footRight = 300;
  const footTop = legBottom;
  const footBottom = legBottom + 50;

  // Heel corner is at (legLeft, legBottom) — bottom-left of leg + top-left of foot
  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} role="img" aria-label="Sock schematic" className="w-full max-w-sm mx-auto">
      <path
        d={`M ${legLeft} ${legTop}
            L ${legRight} ${legTop}
            L ${legRight} ${footTop}
            L ${footRight - 20} ${footTop}
            Q ${footRight} ${footTop} ${footRight} ${(footTop + footBottom) / 2}
            Q ${footRight} ${footBottom} ${footRight - 20} ${footBottom}
            L ${footLeft} ${footBottom}
            Z`}
        fill="#DBEAFE"
        stroke="#2563EB"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Cuff dashed band */}
      <line
        x1={legLeft}
        y1={legTop + 20}
        x2={legRight}
        y2={legTop + 20}
        stroke="#2563EB"
        strokeDasharray="3 2"
        strokeWidth="1"
      />

      {/* Heel corner marker */}
      <circle cx={legLeft} cy={footTop} r="3" fill="#2563EB" />

      {/* Labels */}
      <text x={(legLeft + legRight) / 2} y={legTop - 8} textAnchor="middle" className="fill-gray-700 text-[12px] font-semibold">
        cuff: {output.castOnStitches} sts
      </text>
      <text x={legLeft - 6} y={footTop + 4} textAnchor="end" className="fill-gray-600 text-[10px]">
        heel
      </text>
      <text x={footRight + 6} y={(footTop + footBottom) / 2 + 4} textAnchor="start" className="fill-gray-700 text-[12px] font-semibold">
        toe (grafted)
      </text>

      <text x={(legLeft + legRight) / 2 + 60} y={(legTop + footTop) / 2} textAnchor="start" className="fill-gray-500 text-[11px]">
        leg
      </text>
      <text x={(footLeft + footRight) / 2} y={footBottom + 18} textAnchor="middle" className="fill-gray-500 text-[11px]">
        foot · ankle {formatLength(output.finishedAnkleCircumference, unit)}
      </text>
      <text x={(footLeft + footRight) / 2} y={footBottom + 32} textAnchor="middle" className="fill-gray-500 text-[11px]">
        total length: {formatLength(output.finishedTotalLength, unit)}
      </text>
    </svg>
  );
}
