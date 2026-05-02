import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import {
  createAnnotation,
  deleteAnnotation,
  listAnnotations,
  type PatternAnnotation,
  type PenStrokePayload,
} from '../../lib/sourceFiles';
import { trackEvent } from '../../lib/analytics';

/**
 * Wave 3 annotation overlay. Sits on top of a Wave 2 crop and lets
 * the knitter draw pen strokes, drop highlights, drop text markers.
 *
 * Coords are normalized 0..1 inside the *crop's* rectangle (not the
 * page), so the same annotation survives a re-rasterization at any
 * zoom level — same contract as the underlying crop.
 *
 * The component is purposefully small. Pen + highlight share the same
 * stroke pipeline; text + stamp are TODO and slotted in here when
 * Wave 5 brings the chart symbol palette.
 */

type Tool = 'pen' | 'highlight' | 'eraser' | null;

interface AnnotationLayerProps {
  sourceFileId: string;
  cropId: string;
  /** Currently-selected tool (null = pass-through, no drawing). */
  tool: Tool;
}

export default function AnnotationLayer({
  sourceFileId,
  cropId,
  tool,
}: AnnotationLayerProps) {
  const [annotations, setAnnotations] = useState<PatternAnnotation[]>([]);
  const [activeStroke, setActiveStroke] = useState<Array<{ x: number; y: number }>>(
    []
  );
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    listAnnotations(sourceFileId, cropId)
      .then((rows) => {
        if (!cancelled) setAnnotations(rows);
      })
      .catch(() => {
        // Recoverable: refresh fixes it.
      });
    return () => {
      cancelled = true;
    };
  }, [sourceFileId, cropId]);

  function pointFromEvent(e: React.PointerEvent<SVGElement>): { x: number; y: number } | null {
    if (!wrapperRef.current) return null;
    const { left, top, width: w, height: h } =
      wrapperRef.current.getBoundingClientRect();
    if (w <= 0 || h <= 0) return null;
    return {
      x: clamp01((e.clientX - left) / w),
      y: clamp01((e.clientY - top) / h),
    };
  }

  function handlePointerDown(e: React.PointerEvent<SVGElement>) {
    if (!tool || tool === 'eraser') return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointFromEvent(e);
    if (!p) return;
    setActiveStroke([p]);
  }

  function handlePointerMove(e: React.PointerEvent<SVGElement>) {
    if (!tool || activeStroke.length === 0) return;
    const p = pointFromEvent(e);
    if (!p) return;
    setActiveStroke((prev) => [...prev, p]);
  }

  async function handlePointerUp(e: React.PointerEvent<SVGElement>) {
    if (!tool || activeStroke.length === 0) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const stroke = activeStroke;
    setActiveStroke([]);
    if (stroke.length < 2) return;
    if (tool === 'eraser') return;

    const payload: PenStrokePayload = {
      strokes: [stroke],
      color: tool === 'highlight' ? '#facc15' : '#7c3aed',
      width: 0.005,
      ...(tool === 'highlight' ? { opacity: 0.4 } : {}),
    };
    try {
      const annotation = await createAnnotation(sourceFileId, cropId, {
        annotationType: tool,
        payload,
      });
      setAnnotations((prev) => [...prev, annotation]);
      trackEvent('Annotation Saved', { tool });
    } catch {
      toast.error('Failed to save annotation');
    }
  }

  async function handleEraseClick(annotationId: string) {
    if (tool !== 'eraser') return;
    try {
      await deleteAnnotation(sourceFileId, cropId, annotationId);
      setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
    } catch {
      toast.error('Failed to delete annotation');
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="absolute inset-0"
      style={{ pointerEvents: tool ? 'auto' : 'none' }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {annotations.map((a) => {
          if (a.annotationType === 'pen' || a.annotationType === 'highlight') {
            const p = a.payload as PenStrokePayload;
            const opacity = a.annotationType === 'highlight' ? p.opacity ?? 0.4 : 1;
            return (
              <g
                key={a.id}
                onClick={() => handleEraseClick(a.id)}
                style={{ cursor: tool === 'eraser' ? 'pointer' : 'default' }}
              >
                {p.strokes.map((stroke, i) => (
                  <polyline
                    key={i}
                    points={stroke.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                    fill="none"
                    stroke={p.color}
                    strokeWidth={p.width}
                    strokeOpacity={opacity}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </g>
            );
          }
          return null;
        })}
        {activeStroke.length > 1 ? (
          <polyline
            points={activeStroke.map((pt) => `${pt.x},${pt.y}`).join(' ')}
            fill="none"
            stroke={tool === 'highlight' ? '#facc15' : '#7c3aed'}
            strokeWidth={0.005}
            strokeOpacity={tool === 'highlight' ? 0.4 : 1}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
    </div>
  );
}

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
