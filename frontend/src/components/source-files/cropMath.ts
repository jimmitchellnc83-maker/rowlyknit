/**
 * Pure helpers for the Wave 2 crop drawing UI.
 *
 * Click-drag math gets unit-tested here; the React component just calls
 * these and renders the result. Coords are normalized 0..1 against the
 * page's rendered bounds, top-left origin — same as backend.
 */

export interface NormalizedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/**
 * Translate a pointer event into a normalized point inside the page.
 * Returns null if the page bounds are degenerate (width or height 0).
 */
export function pointInPage(
  bounds: { left: number; top: number; width: number; height: number },
  client: { x: number; y: number }
): { x: number; y: number } | null {
  if (bounds.width <= 0 || bounds.height <= 0) return null;
  return {
    x: clamp01((client.x - bounds.left) / bounds.width),
    y: clamp01((client.y - bounds.top) / bounds.height),
  };
}

/**
 * Convert a click-drag (start + current normalized points) into a
 * normalized rectangle. The rectangle is always positive-area: dragging
 * up-and-left flips the corners back into the standard orientation.
 */
export function dragToRect(
  start: { x: number; y: number },
  current: { x: number; y: number }
): NormalizedRect {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

/**
 * Reject zero-area or barely-perceptible drags client-side. Backend
 * also validates, but a toast is friendlier than a 400.
 */
export function isMeaningfulRect(r: NormalizedRect): boolean {
  return r.width >= 0.01 && r.height >= 0.01;
}
