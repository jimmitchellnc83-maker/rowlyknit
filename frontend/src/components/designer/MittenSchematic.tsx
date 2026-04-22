import type { MittenOutput } from '../../utils/designerMath';

interface MittenSchematicProps {
  output: MittenOutput;
}

/**
 * Flattened mitten silhouette: rounded-top rectangle for the hand with a
 * smaller rounded rectangle branching off for the thumb. Deliberately
 * schematic — proportions don't try to match hand anatomy exactly; they
 * just show which dimension lives where so the labels are legible.
 */
export default function MittenSchematic({ output }: MittenSchematicProps) {
  const viewW = 340;
  const viewH = 380;
  const cx = viewW / 2;
  const handTop = 40;
  const handBottom = 330;
  const handHalfWidth = 60;
  const thumbLeft = cx - handHalfWidth - 30;
  const thumbTop = 180;
  const thumbBottom = 230;

  return (
    <svg viewBox={`0 0 ${viewW} ${viewH}`} role="img" aria-label="Mitten schematic" className="w-full max-w-sm mx-auto">
      {/* Hand: rounded-top rect */}
      <path
        d={`M ${cx - handHalfWidth} ${handBottom}
            L ${cx - handHalfWidth} ${handTop + 40}
            Q ${cx - handHalfWidth} ${handTop} ${cx} ${handTop}
            Q ${cx + handHalfWidth} ${handTop} ${cx + handHalfWidth} ${handTop + 40}
            L ${cx + handHalfWidth} ${handBottom}
            Z`}
        fill="#FEF3C7"
        stroke="#D97706"
        strokeWidth="1.5"
      />
      {/* Thumb: smaller rounded rect off to the left */}
      <path
        d={`M ${thumbLeft} ${thumbBottom}
            L ${thumbLeft} ${thumbTop + 16}
            Q ${thumbLeft} ${thumbTop} ${thumbLeft + 20} ${thumbTop}
            Q ${cx - handHalfWidth} ${thumbTop} ${cx - handHalfWidth} ${thumbTop + 10}
            L ${cx - handHalfWidth} ${thumbBottom}
            Z`}
        fill="#FEF3C7"
        stroke="#D97706"
        strokeWidth="1.5"
      />

      {/* Cuff dashed band at bottom */}
      <line
        x1={cx - handHalfWidth}
        y1={handBottom - 40}
        x2={cx + handHalfWidth}
        y2={handBottom - 40}
        stroke="#D97706"
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
        hand: {output.finishedHandCircumference} in
      </text>
      <text x={cx + handHalfWidth + 8} y={handBottom + 4} textAnchor="start" className="fill-gray-500 text-[11px]">
        total: {output.finishedLength} in
      </text>
    </svg>
  );
}
