import { useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
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
 * Pen + highlight share the stroke pipeline. The toolbar (rendered in
 * the host PDF viewer) feeds in `color` and `width` so the user can
 * pick any color and stroke thickness instead of being locked to the
 * legacy purple/yellow defaults.
 */

type Tool = 'pen' | 'highlight' | 'eraser' | null;

export interface AnnotationLayerHandle {
  /** Soft-delete the most recent stroke, if any. */
  undo: () => Promise<void>;
  /** Restore the most recently undone stroke. */
  redo: () => Promise<void>;
  /** Whether undo/redo are available. */
  canUndo: () => boolean;
  canRedo: () => boolean;
}

interface AnnotationLayerProps {
  sourceFileId: string;
  cropId: string;
  /** Currently-selected tool (null = pass-through, no drawing). */
  tool: Tool;
  /** Stroke color (CSS hex / rgba). Defaults to purple for pen,
   *  yellow for highlight if the host doesn't pass one. */
  color?: string;
  /** Normalized stroke width (0..1 of the crop). 0.005 ≈ a hair-line. */
  strokeWidth?: number;
  /** Highlight opacity. Pen ignores this. */
  opacity?: number;
  /** Notifier so the host's undo/redo buttons can disable themselves
   *  when the stack is empty. Fires on every stroke/undo/redo. */
  onStackChange?: (counts: { undo: number; redo: number }) => void;
}

const AnnotationLayer = forwardRef<AnnotationLayerHandle, AnnotationLayerProps>(
  function AnnotationLayer(
    { sourceFileId, cropId, tool, color, strokeWidth = 0.005, opacity = 0.4, onStackChange },
    ref,
  ) {
    const [annotations, setAnnotations] = useState<PatternAnnotation[]>([]);
    const [activeStroke, setActiveStroke] = useState<Array<{ x: number; y: number }>>(
      [],
    );
    /** Undo stack of the user's own strokes in creation order, capped
     *  at 50 entries to keep the in-memory list bounded. */
    const undoStackRef = useRef<PatternAnnotation[]>([]);
    /** Redo stack — pops here when user undoes; pushes back on redo. */
    const redoStackRef = useRef<PatternAnnotation[]>([]);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const emitStack = () => {
      onStackChange?.({
        undo: undoStackRef.current.length,
        redo: redoStackRef.current.length,
      });
    };

    useEffect(() => {
      let cancelled = false;
      listAnnotations(sourceFileId, cropId)
        .then((rows) => {
          if (!cancelled) {
            setAnnotations(rows);
            // Stack starts at the end of the loaded list so the user
            // can undo back to the most recent saved stroke.
            undoStackRef.current = rows.slice(-50);
            redoStackRef.current = [];
            emitStack();
          }
        })
        .catch(() => {
          // Recoverable: refresh fixes it.
        });
      return () => {
        cancelled = true;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sourceFileId, cropId]);

    useImperativeHandle(
      ref,
      () => ({
        canUndo: () => undoStackRef.current.length > 0,
        canRedo: () => redoStackRef.current.length > 0,
        undo: async () => {
          const last = undoStackRef.current.pop();
          if (!last) return;
          try {
            await deleteAnnotation(sourceFileId, cropId, last.id);
            setAnnotations((prev) => prev.filter((a) => a.id !== last.id));
            redoStackRef.current.push(last);
            emitStack();
          } catch {
            // Restore the stack so the user can try again.
            undoStackRef.current.push(last);
            emitStack();
            toast.error('Could not undo.');
          }
        },
        redo: async () => {
          const popped = redoStackRef.current.pop();
          if (!popped) return;
          try {
            const recreated = await createAnnotation(sourceFileId, cropId, {
              annotationType: popped.annotationType,
              payload: popped.payload,
            });
            setAnnotations((prev) => [...prev, recreated]);
            undoStackRef.current.push(recreated);
            emitStack();
          } catch {
            redoStackRef.current.push(popped);
            emitStack();
            toast.error('Could not redo.');
          }
        },
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [sourceFileId, cropId],
    );

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

      const resolvedColor =
        color ?? (tool === 'highlight' ? '#facc15' : '#7c3aed');
      const payload: PenStrokePayload = {
        strokes: [stroke],
        color: resolvedColor,
        width: strokeWidth,
        ...(tool === 'highlight' ? { opacity } : {}),
      };
      try {
        const annotation = await createAnnotation(sourceFileId, cropId, {
          annotationType: tool,
          payload,
        });
        setAnnotations((prev) => [...prev, annotation]);
        // New stroke creates a fresh future; clear redo.
        undoStackRef.current.push(annotation);
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();
        redoStackRef.current = [];
        emitStack();
        trackEvent('Annotation Saved', { tool });
      } catch {
        toast.error('Failed to save annotation');
      }
    }

    async function handleEraseClick(annotationId: string) {
      if (tool !== 'eraser') return;
      const target = annotations.find((a) => a.id === annotationId);
      try {
        await deleteAnnotation(sourceFileId, cropId, annotationId);
        setAnnotations((prev) => prev.filter((a) => a.id !== annotationId));
        if (target) {
          // Keep the eraser-redo-able by pushing the deleted annotation
          // onto the redo stack; this lets undo+redo walk both directions.
          redoStackRef.current.push(target);
          if (redoStackRef.current.length > 50) redoStackRef.current.shift();
        }
        // Drop matching entries from the undo stack to avoid double-deleting.
        undoStackRef.current = undoStackRef.current.filter((a) => a.id !== annotationId);
        emitStack();
      } catch {
        toast.error('Failed to delete annotation');
      }
    }

    const previewColor =
      color ?? (tool === 'highlight' ? '#facc15' : '#7c3aed');
    const previewOpacity = tool === 'highlight' ? opacity : 1;

    return (
      <div
        ref={wrapperRef}
        className="absolute inset-0"
        style={{ pointerEvents: tool ? 'auto' : 'none', touchAction: tool ? 'none' : 'auto' }}
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
              const drawnOpacity =
                a.annotationType === 'highlight' ? p.opacity ?? 0.4 : 1;
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
                      strokeOpacity={drawnOpacity}
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
              stroke={previewColor}
              strokeWidth={strokeWidth}
              strokeOpacity={previewOpacity}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
        </svg>
      </div>
    );
  },
);

export default AnnotationLayer;

function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
