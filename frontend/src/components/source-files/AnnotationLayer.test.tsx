/**
 * Tests for the annotation pen / highlighter / eraser contract.
 *
 * The DOM-side pointer-capture machinery is a thin layer over an SVG
 * surface; the meaningful contracts are:
 *
 *   1. Pen records `annotationType: 'pen'` with full opacity on save.
 *   2. Highlighter records `annotationType: 'highlight'` with an
 *      `opacity` payload (translucent) and a wider default stroke.
 *   3. Eraser scrub deletes a stroke whose path passes near the
 *      cursor — by drag, not by clicking the entire stroke. We
 *      exercise this through the underlying hit-test helper since
 *      jsdom doesn't have a layout for SVG bounding boxes.
 *   4. Undo deletes the latest stroke; redo recreates it.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { createRef } from 'react';

const createAnnotationMock = vi.fn();
const deleteAnnotationMock = vi.fn();
const listAnnotationsMock = vi.fn();

vi.mock('../../lib/sourceFiles', async () => {
  const actual = await vi.importActual<typeof import('../../lib/sourceFiles')>(
    '../../lib/sourceFiles',
  );
  return {
    ...actual,
    createAnnotation: (...args: unknown[]) => createAnnotationMock(...args),
    deleteAnnotation: (...args: unknown[]) => deleteAnnotationMock(...args),
    listAnnotations: (...args: unknown[]) => listAnnotationsMock(...args),
  };
});

vi.mock('../../lib/analytics', () => ({
  trackEvent: vi.fn(),
}));

import AnnotationLayer, {
  type AnnotationLayerHandle,
  pointToSegmentDistanceSq,
  strokeIntersectsCircle,
} from './AnnotationLayer';
import type { PatternAnnotation, PenStrokePayload } from '../../lib/sourceFiles';

afterEach(() => {
  vi.clearAllMocks();
});

function makeStroke(
  id: string,
  type: 'pen' | 'highlight',
  points: Array<{ x: number; y: number }>,
  width = 0.005,
  opacity?: number,
): PatternAnnotation {
  const payload: PenStrokePayload = {
    strokes: [points],
    color: type === 'pen' ? '#7c3aed' : '#facc15',
    width,
    ...(opacity !== undefined ? { opacity } : {}),
  };
  return {
    id,
    patternCropId: 'crop-1',
    userId: 'u-1',
    annotationType: type,
    payload,
    createdAt: '',
    updatedAt: '',
    deletedAt: null,
  };
}

describe('AnnotationLayer pen vs highlighter render contract', () => {
  it('renders pen strokes opaque with round caps; highlights translucent with butt caps', async () => {
    listAnnotationsMock.mockResolvedValueOnce([
      makeStroke('p1', 'pen', [
        { x: 0.1, y: 0.1 },
        { x: 0.4, y: 0.4 },
      ], 0.005),
      makeStroke(
        'h1',
        'highlight',
        [
          { x: 0.5, y: 0.5 },
          { x: 0.9, y: 0.5 },
        ],
        0.025,
        0.35,
      ),
    ]);
    const { container } = render(
      <AnnotationLayer sourceFileId="sf-1" cropId="crop-1" tool={null} />,
    );
    // Wait one tick for the listAnnotations promise to resolve.
    await act(async () => {
      await Promise.resolve();
    });
    const polylines = container.querySelectorAll('polyline');
    expect(polylines.length).toBe(2);
    const pen = container.querySelector('[data-annotation-id="p1"] polyline')!;
    const highlight = container.querySelector('[data-annotation-id="h1"] polyline')!;
    expect(pen.getAttribute('stroke-opacity')).toBe('1');
    expect(pen.getAttribute('stroke-linecap')).toBe('round');
    expect(highlight.getAttribute('stroke-opacity')).toBe('0.35');
    expect(highlight.getAttribute('stroke-linecap')).toBe('butt');
    // Highlighter is materially wider than the pen.
    expect(Number(highlight.getAttribute('stroke-width'))).toBeGreaterThan(
      Number(pen.getAttribute('stroke-width')),
    );
  });
});

describe('AnnotationLayer undo + redo', () => {
  it('undo deletes the latest stroke and pushes onto redo', async () => {
    const existing = makeStroke('p1', 'pen', [
      { x: 0.1, y: 0.1 },
      { x: 0.4, y: 0.4 },
    ]);
    listAnnotationsMock.mockResolvedValueOnce([existing]);
    deleteAnnotationMock.mockResolvedValue(undefined);
    const ref = createRef<AnnotationLayerHandle>();
    const onStackChange = vi.fn();
    render(
      <AnnotationLayer
        ref={ref}
        sourceFileId="sf-1"
        cropId="crop-1"
        tool="pen"
        onStackChange={onStackChange}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    // Stack starts at 1 (the loaded annotation).
    expect(onStackChange).toHaveBeenCalledWith({ undo: 1, redo: 0 });
    expect(ref.current!.canUndo()).toBe(true);
    await act(async () => {
      await ref.current!.undo();
    });
    expect(deleteAnnotationMock).toHaveBeenCalledWith('sf-1', 'crop-1', 'p1');
    expect(ref.current!.canUndo()).toBe(false);
    expect(ref.current!.canRedo()).toBe(true);
  });

  it('redo recreates the most recently undone stroke', async () => {
    const existing = makeStroke('p1', 'pen', [
      { x: 0.1, y: 0.1 },
      { x: 0.4, y: 0.4 },
    ]);
    listAnnotationsMock.mockResolvedValueOnce([existing]);
    deleteAnnotationMock.mockResolvedValue(undefined);
    createAnnotationMock.mockResolvedValueOnce({ ...existing, id: 'p1-redo' });
    const ref = createRef<AnnotationLayerHandle>();
    render(
      <AnnotationLayer ref={ref} sourceFileId="sf-1" cropId="crop-1" tool="pen" />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    await act(async () => {
      await ref.current!.undo();
    });
    expect(ref.current!.canRedo()).toBe(true);
    await act(async () => {
      await ref.current!.redo();
    });
    expect(createAnnotationMock).toHaveBeenCalledTimes(1);
    expect(ref.current!.canUndo()).toBe(true);
    expect(ref.current!.canRedo()).toBe(false);
  });
});

describe('eraser hit-test math', () => {
  it('reports a hit when the cursor lands directly on the path', () => {
    const stroke = [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
    ];
    expect(strokeIntersectsCircle([stroke], { x: 0.5, y: 0.2 }, 0.01)).toBe(true);
  });

  it('reports a hit when the cursor is within the eraser radius perpendicular to the path', () => {
    const stroke = [
      { x: 0.2, y: 0.2 },
      { x: 0.8, y: 0.2 },
    ];
    // Cursor 0.02 below the horizontal stroke; radius 0.03 → hit.
    expect(strokeIntersectsCircle([stroke], { x: 0.5, y: 0.22 }, 0.03)).toBe(true);
    // Outside the radius → miss.
    expect(strokeIntersectsCircle([stroke], { x: 0.5, y: 0.3 }, 0.03)).toBe(false);
  });

  it('reports a miss when the cursor is far from every segment', () => {
    const stroke = [
      { x: 0.0, y: 0.0 },
      { x: 0.1, y: 0.1 },
    ];
    expect(strokeIntersectsCircle([stroke], { x: 0.9, y: 0.9 }, 0.05)).toBe(false);
  });

  it('handles single-point strokes (degenerate)', () => {
    expect(strokeIntersectsCircle([[{ x: 0.5, y: 0.5 }]], { x: 0.5, y: 0.5 }, 0.001)).toBe(
      true,
    );
    expect(strokeIntersectsCircle([[{ x: 0.5, y: 0.5 }]], { x: 0.6, y: 0.6 }, 0.05)).toBe(
      false,
    );
  });
});

describe('pointToSegmentDistanceSq', () => {
  it('returns 0 for a point on the segment', () => {
    const d = pointToSegmentDistanceSq(
      { x: 0.5, y: 0.5 },
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 },
    );
    expect(d).toBe(0);
  });

  it('returns the squared distance to the closest endpoint when the projection falls outside', () => {
    // Segment 0..1 on the X axis. Cursor at (-0.1, 0). Closest is the
    // start endpoint (0,0); distance is 0.1, squared is 0.01.
    const d = pointToSegmentDistanceSq(
      { x: -0.1, y: 0 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    );
    expect(d).toBeCloseTo(0.01, 6);
  });

  it('handles degenerate (zero-length) segments by returning the squared distance to the point', () => {
    const d = pointToSegmentDistanceSq(
      { x: 0.5, y: 0.5 },
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    );
    expect(d).toBeCloseTo(0.5, 6);
  });
});
