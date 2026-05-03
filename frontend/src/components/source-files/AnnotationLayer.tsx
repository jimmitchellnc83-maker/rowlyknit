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
 * Wave 3 annotation overlay. Three tools, each with its own feel:
 *
 *   - **Pen** — narrow, fully opaque, round caps. Behaves like a fine
 *     marker for writing notes ("dec 4 here", row arrows, etc.).
 *   - **Highlighter** — broad, translucent, butt caps. Behaves like a
 *     real chisel-tip highlighter — drag across a row of text and it
 *     paints a yellow band you can still read through.
 *   - **Eraser** — drag-to-scrub. As the cursor passes over a stroke
 *     anywhere along its length, that stroke is deleted. No more
 *     "click the entire group" hit-testing.
 *
 * Coords are normalized 0..1 inside the *crop's* rectangle, same as
 * before, so an annotation survives re-rasterization at any zoom.
 *
 * The host viewer feeds in `tool`, `color`, `width` (per-tool defaults
 * applied at the call site so each tool has a sensible starting size).
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
  /** Normalized stroke width (0..1 of the crop). For pen this is the
   *  pen tip; for highlight, the chisel width; for eraser, the scrub
   *  radius. The host owns the slider so each tool gets its own size. */
  strokeWidth?: number;
  /** Highlight opacity. Pen ignores this. */
  opacity?: number;
  /** Notifier so the host's undo/redo buttons can disable themselves
   *  when the stack is empty. Fires on every stroke/undo/redo. */
  onStackChange?: (counts: { undo: number; redo: number }) => void;
}

/** Default highlight opacity. Translucent enough that text underneath
 *  remains readable; saturated enough to look like a real highlighter. */
const HIGHLIGHT_OPACITY = 0.35;

const AnnotationLayer = forwardRef<AnnotationLayerHandle, AnnotationLayerProps>(
  function AnnotationLayer(
    { sourceFileId, cropId, tool, color, strokeWidth = 0.005, opacity = HIGHLIGHT_OPACITY, onStackChange },
    ref,
  ) {
    const [annotations, setAnnotations] = useState<PatternAnnotation[]>([]);
    const [activeStroke, setActiveStroke] = useState<Array<{ x: number; y: number }>>(
      [],
    );
    /** Eraser preview position (normalized 0..1) — drives the
     *  see-the-tip cursor circle so the user can aim. Cleared on
     *  pointer-up. */
    const [eraserCursor, setEraserCursor] = useState<{ x: number; y: number } | null>(
      null,
    );
    /** Undo stack of the user's own strokes in creation order, capped
     *  at 50 entries to keep the in-memory list bounded. */
    const undoStackRef = useRef<PatternAnnotation[]>([]);
    /** Redo stack — pops here when user undoes; pushes back on redo. */
    const redoStackRef = useRef<PatternAnnotation[]>([]);
    /** Eraser scrub state — IDs already scheduled for deletion this
     *  drag, so a second pass over the same stroke doesn't double-fire. */
    const erasedThisDragRef = useRef<Set<string>>(new Set());
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
      if (!tool) return;
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = pointFromEvent(e);
      if (!p) return;
      if (tool === 'eraser') {
        // Start a new scrub session and immediately try to erase
        // anything under the click — a tap-erase on a stroke counts.
        erasedThisDragRef.current = new Set();
        setEraserCursor(p);
        void scrubAt(p);
        return;
      }
      setActiveStroke([p]);
    }

    function handlePointerMove(e: React.PointerEvent<SVGElement>) {
      if (!tool) return;
      const p = pointFromEvent(e);
      if (!p) return;
      if (tool === 'eraser') {
        if (eraserCursor) {
          setEraserCursor(p);
          void scrubAt(p);
        }
        return;
      }
      if (activeStroke.length === 0) return;
      setActiveStroke((prev) => [...prev, p]);
    }

    async function handlePointerUp(e: React.PointerEvent<SVGElement>) {
      if (!tool) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      if (tool === 'eraser') {
        setEraserCursor(null);
        erasedThisDragRef.current = new Set();
        return;
      }
      if (activeStroke.length === 0) return;
      const stroke = activeStroke;
      setActiveStroke([]);
      if (stroke.length < 2) return;

      const resolvedColor =
        color ?? (tool === 'highlight' ? '#facc15' : '#7c3aed');
      const resolvedWidth = strokeWidth;
      const payload: PenStrokePayload = {
        strokes: [stroke],
        color: resolvedColor,
        width: resolvedWidth,
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

    /**
     * Eraser scrubbing — at the current cursor, find every stroke
     * annotation whose path passes within `eraserRadius` of the
     * cursor and delete it. Keeps a per-drag set of already-erased
     * IDs so passing the cursor over the same stroke twice is a
     * no-op.
     */
    async function scrubAt(cursor: { x: number; y: number }) {
      const eraserRadius = Math.max(strokeWidth, 0.01);
      const hits: PatternAnnotation[] = [];
      for (const a of annotations) {
        if (a.annotationType !== 'pen' && a.annotationType !== 'highlight') continue;
        if (erasedThisDragRef.current.has(a.id)) continue;
        const p = a.payload as PenStrokePayload;
        const radius = eraserRadius + (p.width ?? 0.005) / 2;
        if (strokeIntersectsCircle(p.strokes, cursor, radius)) {
          erasedThisDragRef.current.add(a.id);
          hits.push(a);
        }
      }
      if (hits.length === 0) return;
      // Optimistic local removal so the user sees instant feedback.
      setAnnotations((prev) => prev.filter((x) => !hits.find((h) => h.id === x.id)));
      undoStackRef.current = undoStackRef.current.filter(
        (x) => !hits.find((h) => h.id === x.id),
      );
      // Push erased strokes onto redo so undo+redo can walk both ways.
      for (const h of hits) {
        redoStackRef.current.push(h);
        if (redoStackRef.current.length > 50) redoStackRef.current.shift();
      }
      emitStack();
      // Server reconciliation. If a delete fails, put the stroke back.
      const failures: PatternAnnotation[] = [];
      await Promise.all(
        hits.map(async (h) => {
          try {
            await deleteAnnotation(sourceFileId, cropId, h.id);
          } catch {
            failures.push(h);
          }
        }),
      );
      if (failures.length > 0) {
        setAnnotations((prev) => [...prev, ...failures]);
        // Roll the failed entries off the redo stack.
        redoStackRef.current = redoStackRef.current.filter(
          (x) => !failures.find((f) => f.id === x.id),
        );
        emitStack();
        toast.error(
          failures.length === 1
            ? 'Could not erase one stroke.'
            : `Could not erase ${failures.length} strokes.`,
        );
      } else if (hits.length > 0) {
        trackEvent('Annotation Erased', { count: hits.length });
      }
    }

    const previewColor =
      color ?? (tool === 'highlight' ? '#facc15' : '#7c3aed');
    const previewOpacity = tool === 'highlight' ? opacity : 1;
    // Highlighter uses butt linecap so strokes look like a real
    // chisel-tip; pen uses round so handwriting feels natural. Eraser
    // never draws a stroke — we paint a cursor instead.
    const previewLinecap: 'round' | 'butt' = tool === 'highlight' ? 'butt' : 'round';
    const previewLinejoin: 'round' | 'miter' = tool === 'highlight' ? 'miter' : 'round';

    return (
      <div
        ref={wrapperRef}
        className="absolute inset-0"
        style={{
          pointerEvents: tool ? 'auto' : 'none',
          touchAction: tool ? 'none' : 'auto',
          cursor:
            tool === 'eraser'
              ? 'crosshair'
              : tool === 'highlight' || tool === 'pen'
                ? 'crosshair'
                : 'default',
        }}
        data-testid={`annotation-layer-${tool ?? 'idle'}`}
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
          onPointerCancel={handlePointerUp}
        >
          {annotations.map((a) => {
            if (a.annotationType === 'pen' || a.annotationType === 'highlight') {
              const p = a.payload as PenStrokePayload;
              const drawnOpacity =
                a.annotationType === 'highlight' ? p.opacity ?? HIGHLIGHT_OPACITY : 1;
              const linecap: 'round' | 'butt' =
                a.annotationType === 'highlight' ? 'butt' : 'round';
              const linejoin: 'round' | 'miter' =
                a.annotationType === 'highlight' ? 'miter' : 'round';
              return (
                <g key={a.id} data-annotation-id={a.id}>
                  {p.strokes.map((stroke, i) => (
                    <polyline
                      key={i}
                      points={stroke.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                      fill="none"
                      stroke={p.color}
                      strokeWidth={p.width}
                      strokeOpacity={drawnOpacity}
                      strokeLinecap={linecap}
                      strokeLinejoin={linejoin}
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
              strokeLinecap={previewLinecap}
              strokeLinejoin={previewLinejoin}
              vectorEffect="non-scaling-stroke"
              data-testid="annotation-preview"
            />
          ) : null}
          {tool === 'eraser' && eraserCursor ? (
            <circle
              cx={eraserCursor.x}
              cy={eraserCursor.y}
              r={Math.max(strokeWidth, 0.01)}
              fill="rgba(248, 113, 113, 0.15)"
              stroke="rgba(220, 38, 38, 0.7)"
              strokeWidth={0.002}
              vectorEffect="non-scaling-stroke"
              data-testid="eraser-cursor"
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

/**
 * Eraser hit-test. Returns true if any segment of any stroke comes
 * within `radius` of `cursor`. Operates entirely in normalized
 * coords — same space the strokes were saved in.
 */
export function strokeIntersectsCircle(
  strokes: Array<Array<{ x: number; y: number }>>,
  cursor: { x: number; y: number },
  radius: number,
): boolean {
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    if (stroke.length === 1) {
      // Degenerate single-point stroke. Treat as a point.
      const dx = stroke[0].x - cursor.x;
      const dy = stroke[0].y - cursor.y;
      if (dx * dx + dy * dy <= radius * radius) return true;
      continue;
    }
    for (let i = 0; i < stroke.length - 1; i++) {
      const a = stroke[i];
      const b = stroke[i + 1];
      if (pointToSegmentDistanceSq(cursor, a, b) <= radius * radius) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Squared distance from a point to a line segment, in the same units
 * as the inputs. Used by the eraser hit-test; squared so the hot path
 * avoids a sqrt per segment.
 */
export function pointToSegmentDistanceSq(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const segLenSq = dx * dx + dy * dy;
  if (segLenSq === 0) {
    const px = p.x - a.x;
    const py = p.y - a.y;
    return px * px + py * py;
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / segLenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  const ex = p.x - cx;
  const ey = p.y - cy;
  return ex * ex + ey * ey;
}
