/**
 * Schematics map the user's chosen main color (form.colors[0]) onto the
 * silhouette so the preview reads as the actual yarn the knitter plans to
 * use rather than a generic accent. Stroke/accent shades are derived from
 * the main color so the schematic stays readable across light, dark, and
 * saturated picks.
 */

export interface SchematicPalette {
  /** Body fill of the silhouette. */
  fill: string;
  /** Outline stroke. */
  stroke: string;
  /** Brim / hem / cuff band — slightly darker than fill for legibility. */
  accent: string;
  /** Text color that sits on top of `fill` (chosen for contrast). */
  onFill: string;
}

function parseHex(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '').match(/.{1,2}/g);
  if (!m || m.length !== 3) return null;
  const parts = m.map((h) => parseInt(h, 16));
  if (parts.some((n) => Number.isNaN(n))) return null;
  return [parts[0], parts[1], parts[2]];
}

function toHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[r, g, b].map((c) => clamp(c).toString(16).padStart(2, '0')).join('')}`;
}

function mix(hex: string, target: [number, number, number], ratio: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  const [tr, tg, tb] = target;
  return toHex(r + (tr - r) * ratio, g + (tg - g) * ratio, b + (tb - b) * ratio);
}

export function luminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((c) => c / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Build the schematic palette from the user's main color. Falls back to
 * the supplied accent (per-garment-type defaults) when no main color is set.
 */
export function paletteFromMainColor(
  mainColor: string | null | undefined,
  fallback: { fill: string; stroke: string; accent: string },
): SchematicPalette {
  if (!mainColor || !parseHex(mainColor)) {
    return { ...fallback, onFill: luminance(fallback.fill) > 0.55 ? '#111' : '#FFF' };
  }
  const stroke = mix(mainColor, [0, 0, 0], 0.35);
  const accent = mix(mainColor, [0, 0, 0], 0.15);
  return {
    fill: mainColor,
    stroke,
    accent,
    onFill: luminance(mainColor) > 0.55 ? '#111' : '#FFF',
  };
}
