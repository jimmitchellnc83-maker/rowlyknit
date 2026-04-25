/**
 * User-defined custom garment shape for the Pattern Designer.
 *
 * Vertices are normalized to [0, 1] in both x and y so the shape scales
 * cleanly when widthInches / heightInches change. Origin is top-left
 * (matches SVG conventions): y=0 is the top edge of the bounding box,
 * y=1 is the bottom (cast-on / hem) edge.
 *
 * The polygon is implicitly closed (last vertex connects to first).
 * Minimum 3 vertices for a valid polygon; the editor enforces this.
 */
export interface CustomVertex {
  /** 0 = left, 1 = right of the bounding box. */
  x: number;
  /** 0 = top, 1 = bottom of the bounding box. */
  y: number;
}

export interface CustomShape {
  widthInches: number;
  heightInches: number;
  vertices: CustomVertex[];
}

export const DEFAULT_CUSTOM_SHAPE: CustomShape = {
  widthInches: 24,
  heightInches: 24,
  vertices: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
};

/** Build an SVG path string from a custom shape, scaled into a target
 *  rect at (offsetX, offsetY) with size (drawW, drawH). Empty string
 *  for shapes with fewer than 3 vertices. */
export function customShapeToPath(
  shape: CustomShape,
  offsetX: number,
  offsetY: number,
  drawW: number,
  drawH: number,
): string {
  if (shape.vertices.length < 3) return '';
  const points = shape.vertices.map(
    (v) => `${offsetX + v.x * drawW} ${offsetY + v.y * drawH}`,
  );
  return `M ${points.join(' L ')} Z`;
}
