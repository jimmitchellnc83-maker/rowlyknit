interface RectSchematicProps {
  /** Finished width in inches (outer dimension). */
  widthInches: number;
  /** Finished length in inches (outer dimension). */
  lengthInches: number;
  /** Stitch count at cast-on edge. */
  castOnStitches: number;
  /** Optional border depth in inches (rendered as a dashed inner frame). */
  borderInches?: number;
  /** Optional fringe length in inches (rendered as comb on each short end). */
  fringeInches?: number;
  /** Visual accent color — purple for scarf, green for blanket, etc. */
  accent?: 'purple' | 'green' | 'teal';
  /** Human-friendly label that appears as the schematic's title. */
  label: string;
}

const ACCENTS: Record<NonNullable<RectSchematicProps['accent']>, { fill: string; stroke: string; band: string }> = {
  purple: { fill: '#F5F3FF', stroke: '#7C3AED', band: '#DDD6FE' },
  green: { fill: '#ECFDF5', stroke: '#059669', band: '#A7F3D0' },
  teal: { fill: '#ECFEFF', stroke: '#0891B2', band: '#A5F3FC' },
};

/**
 * Shared rectangular schematic for scarf / blanket / any other flat-rectangle
 * item. Renders the main body as a colored rectangle, with an optional
 * dashed inner frame showing the border depth (blankets) and optional
 * "comb" fringe on each short end (scarves). The aspect ratio is preserved
 * — a long narrow scarf renders tall and thin, a blanket renders wider.
 */
export default function RectSchematic({
  widthInches,
  lengthInches,
  castOnStitches,
  borderInches = 0,
  fringeInches = 0,
  accent = 'purple',
  label,
}: RectSchematicProps) {
  const viewW = 320;
  const viewH = 380;
  const marginX = 50;
  const marginY = 50;
  const areaW = viewW - marginX * 2;
  const areaH = viewH - marginY * 2;
  const cx = viewW / 2;

  // Preserve aspect — scale by the longer dimension.
  const aspect = Math.max(0.01, widthInches) / Math.max(0.01, lengthInches);
  // Target: fit within (areaW × areaH) maintaining aspect.
  const maxW = Math.min(areaW, areaH * aspect);
  const maxH = maxW / aspect;
  const rectLeft = cx - maxW / 2;
  const rectTop = marginY + (areaH - maxH) / 2;
  const rectBottom = rectTop + maxH;
  const rectRight = rectLeft + maxW;

  const colors = ACCENTS[accent];

  // Border inset — percentage of rect width/height based on borderInches.
  const borderInsetX = borderInches > 0 ? (borderInches / widthInches) * maxW : 0;
  const borderInsetY = borderInches > 0 ? (borderInches / lengthInches) * maxH : 0;

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      role="img"
      aria-label={`${label} schematic`}
      className="w-full max-w-sm mx-auto"
    >
      {/* Main rectangle */}
      <rect
        x={rectLeft}
        y={rectTop}
        width={maxW}
        height={maxH}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="1.5"
      />

      {/* Border frame (dashed inner rectangle) */}
      {borderInches > 0 && (
        <rect
          x={rectLeft + borderInsetX}
          y={rectTop + borderInsetY}
          width={Math.max(0, maxW - 2 * borderInsetX)}
          height={Math.max(0, maxH - 2 * borderInsetY)}
          fill={colors.band}
          fillOpacity="0.35"
          stroke={colors.stroke}
          strokeWidth="0.75"
          strokeDasharray="3 2"
        />
      )}

      {/* Fringe combs — only on short ends of scarves */}
      {fringeInches > 0 && (
        <>
          {Array.from({ length: 12 }).map((_, i) => {
            const x = rectLeft + ((i + 0.5) / 12) * maxW;
            return (
              <line
                key={`fringe-top-${i}`}
                x1={x}
                y1={rectTop}
                x2={x}
                y2={rectTop - 12}
                stroke={colors.stroke}
                strokeWidth="0.75"
                opacity="0.7"
              />
            );
          })}
          {Array.from({ length: 12 }).map((_, i) => {
            const x = rectLeft + ((i + 0.5) / 12) * maxW;
            return (
              <line
                key={`fringe-bot-${i}`}
                x1={x}
                y1={rectBottom}
                x2={x}
                y2={rectBottom + 12}
                stroke={colors.stroke}
                strokeWidth="0.75"
                opacity="0.7"
              />
            );
          })}
        </>
      )}

      {/* Cast-on stitch count (below rect) */}
      <text
        x={cx}
        y={rectBottom + (fringeInches > 0 ? 28 : 18)}
        textAnchor="middle"
        className="fill-gray-700 text-[13px] font-semibold"
      >
        ← {castOnStitches} sts (cast on) →
      </text>

      {/* Width (above rect) */}
      <text
        x={cx}
        y={rectTop - (fringeInches > 0 ? 18 : 8)}
        textAnchor="middle"
        className="fill-gray-600 text-[11px]"
      >
        {widthInches} in wide
      </text>

      {/* Length (right side, rotated) */}
      <text
        x={rectRight + 14}
        y={(rectTop + rectBottom) / 2}
        textAnchor="middle"
        transform={`rotate(90 ${rectRight + 14} ${(rectTop + rectBottom) / 2})`}
        className="fill-gray-500 text-[11px]"
      >
        {lengthInches} in long
      </text>

      {/* Border note */}
      {borderInches > 0 && (
        <text
          x={rectLeft + borderInsetX + 4}
          y={rectTop + borderInsetY + 12}
          className="fill-gray-500 text-[10px]"
        >
          {borderInches} in border
        </text>
      )}
    </svg>
  );
}
