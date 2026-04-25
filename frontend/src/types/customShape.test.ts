import { describe, it, expect } from 'vitest';
import {
  customShapeToPath,
  DEFAULT_CUSTOM_SHAPE,
  type CustomShape,
} from './customShape';

describe('customShapeToPath', () => {
  it('returns empty string for shapes with fewer than 3 vertices', () => {
    const tooFew: CustomShape = {
      widthInches: 10,
      heightInches: 10,
      vertices: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    };
    expect(customShapeToPath(tooFew, 0, 0, 100, 100)).toBe('');
  });

  it('builds a closed path from vertices in normalized space', () => {
    const triangle: CustomShape = {
      widthInches: 10,
      heightInches: 10,
      vertices: [
        { x: 0.5, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
    };
    const path = customShapeToPath(triangle, 0, 0, 100, 100);
    expect(path).toBe('M 50 0 L 100 100 L 0 100 Z');
  });

  it('respects offset and target rect size', () => {
    const path = customShapeToPath(DEFAULT_CUSTOM_SHAPE, 10, 20, 200, 100);
    // Default is a unit square; expect corners at (10,20), (210,20), (210,120), (10,120)
    expect(path).toBe('M 10 20 L 210 20 L 210 120 L 10 120 Z');
  });
});

describe('DEFAULT_CUSTOM_SHAPE', () => {
  it('is a valid 4-vertex rectangle in normalized space', () => {
    expect(DEFAULT_CUSTOM_SHAPE.vertices.length).toBe(4);
    expect(DEFAULT_CUSTOM_SHAPE.widthInches).toBeGreaterThan(0);
    expect(DEFAULT_CUSTOM_SHAPE.heightInches).toBeGreaterThan(0);
    for (const v of DEFAULT_CUSTOM_SHAPE.vertices) {
      expect(v.x).toBeGreaterThanOrEqual(0);
      expect(v.x).toBeLessThanOrEqual(1);
      expect(v.y).toBeGreaterThanOrEqual(0);
      expect(v.y).toBeLessThanOrEqual(1);
    }
  });
});
