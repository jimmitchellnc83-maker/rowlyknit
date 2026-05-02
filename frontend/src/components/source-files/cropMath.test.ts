import { describe, it, expect } from 'vitest';
import {
  clamp01,
  dragToRect,
  isMeaningfulRect,
  pointInPage,
} from './cropMath';

describe('clamp01', () => {
  it('clamps below 0 to 0', () => {
    expect(clamp01(-0.5)).toBe(0);
  });
  it('clamps above 1 to 1', () => {
    expect(clamp01(1.5)).toBe(1);
  });
  it('passes mid values through', () => {
    expect(clamp01(0.5)).toBe(0.5);
  });
});

describe('pointInPage', () => {
  const bounds = { left: 100, top: 200, width: 600, height: 800 };

  it('maps the top-left corner to (0, 0)', () => {
    expect(pointInPage(bounds, { x: 100, y: 200 })).toEqual({ x: 0, y: 0 });
  });

  it('maps the bottom-right corner to (1, 1)', () => {
    expect(pointInPage(bounds, { x: 700, y: 1000 })).toEqual({ x: 1, y: 1 });
  });

  it('maps the center', () => {
    expect(pointInPage(bounds, { x: 400, y: 600 })).toEqual({ x: 0.5, y: 0.5 });
  });

  it('clamps to [0, 1] for clicks outside the bounds', () => {
    expect(pointInPage(bounds, { x: 50, y: 100 })).toEqual({ x: 0, y: 0 });
    expect(pointInPage(bounds, { x: 1000, y: 5000 })).toEqual({ x: 1, y: 1 });
  });

  it('returns null for degenerate bounds', () => {
    expect(pointInPage({ left: 0, top: 0, width: 0, height: 100 }, { x: 0, y: 0 })).toBeNull();
    expect(pointInPage({ left: 0, top: 0, width: 100, height: 0 }, { x: 0, y: 0 })).toBeNull();
  });
});

describe('dragToRect', () => {
  it('returns a positive-area rect for a top-left → bottom-right drag', () => {
    const r = dragToRect({ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.7 });
    expect(r.x).toBeCloseTo(0.1);
    expect(r.y).toBeCloseTo(0.2);
    expect(r.width).toBeCloseTo(0.4);
    expect(r.height).toBeCloseTo(0.5);
  });

  it('flips bottom-right → top-left drags back into standard orientation', () => {
    const r = dragToRect({ x: 0.5, y: 0.7 }, { x: 0.1, y: 0.2 });
    expect(r.x).toBeCloseTo(0.1);
    expect(r.y).toBeCloseTo(0.2);
    expect(r.width).toBeCloseTo(0.4);
    expect(r.height).toBeCloseTo(0.5);
  });

  it('handles zero-distance drag (single click)', () => {
    expect(dragToRect({ x: 0.3, y: 0.3 }, { x: 0.3, y: 0.3 })).toEqual({
      x: 0.3,
      y: 0.3,
      width: 0,
      height: 0,
    });
  });
});

describe('isMeaningfulRect', () => {
  it('rejects zero-area rects', () => {
    expect(isMeaningfulRect({ x: 0, y: 0, width: 0, height: 0 })).toBe(false);
  });

  it('rejects barely-perceptible drags below 1% of the page', () => {
    expect(isMeaningfulRect({ x: 0, y: 0, width: 0.005, height: 0.5 })).toBe(false);
    expect(isMeaningfulRect({ x: 0, y: 0, width: 0.5, height: 0.005 })).toBe(false);
  });

  it('accepts a real selection', () => {
    expect(isMeaningfulRect({ x: 0, y: 0, width: 0.05, height: 0.05 })).toBe(true);
  });
});
