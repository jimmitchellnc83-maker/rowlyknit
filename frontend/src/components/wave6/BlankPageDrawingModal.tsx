import { useEffect, useRef, useState } from 'react';
import { FiX, FiSave, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { updateBlankPage, type BlankPage } from '../../lib/wave6';

interface Props {
  projectId: string;
  page: BlankPage;
  onClose: () => void;
  onSaved: (page: BlankPage) => void;
}

interface Stroke {
  color: string;
  width: number;
  points: Array<{ x: number; y: number }>;
}

const COLORS = ['#1F2937', '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];

/**
 * Lightweight HTML5 canvas drawing modal for a Wave 6 blank page.
 * Strokes are stored as point arrays in the same shape Wave 3 uses
 * (so future features can converge formats). Save persists the strokes
 * payload via PATCH.
 */
export default function BlankPageDrawingModal({
  projectId,
  page,
  onClose,
  onSaved,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState<string>(COLORS[0]);
  const [width, setWidth] = useState<number>(3);
  const [strokes, setStrokes] = useState<Stroke[]>(() => {
    if (Array.isArray(page.strokes)) return page.strokes as Stroke[];
    return [];
  });
  const [drawing, setDrawing] = useState<Stroke | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingClear, setPendingClear] = useState(false);

  // Render canvas on size change + every stroke update.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const all = drawing ? [...strokes, drawing] : strokes;
    for (const s of all) {
      if (s.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(s.points[0].x, s.points[0].y);
      for (let i = 1; i < s.points.length; i++) {
        ctx.lineTo(s.points[i].x, s.points[i].y);
      }
      ctx.stroke();
    }
  }, [strokes, drawing]);

  // Pixel dimensions for the canvas. Page width/height are in inches;
  // render at 72 DPI for a reasonable on-screen size, capped to the
  // viewport.
  const dpi = 72;
  const baseW = page.width * dpi;
  const baseH = page.height * dpi;
  const maxW = typeof window !== 'undefined' ? window.innerWidth - 120 : 720;
  const scale = Math.min(1, maxW / baseW);
  const canvasW = Math.round(baseW * scale);
  const canvasH = Math.round(baseH * scale);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return;
    const p = pointFromEvent(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrawing({ color, width, points: [p] });
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    const p = pointFromEvent(e);
    if (!p) return;
    setDrawing({ ...drawing, points: [...drawing.points, p] });
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (drawing.points.length >= 2) {
      setStrokes((prev) => [...prev, drawing]);
    }
    setDrawing(null);
  }

  function handleClear() {
    if (!pendingClear) {
      setPendingClear(true);
      return;
    }
    setStrokes([]);
    setPendingClear(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await updateBlankPage(projectId, page.id, { strokes });
      toast.success('Page saved.');
      onSaved(saved);
    } catch {
      toast.error('Failed to save page.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-gray-900 dark:text-gray-100">
            {page.name ?? 'Untitled blank page'}
          </h4>
          <div className="flex items-center gap-2">
            {pendingClear ? (
              <>
                <span className="text-xs text-amber-700 dark:text-amber-300">
                  Clear all strokes?
                </span>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-sm font-medium text-red-700 hover:text-red-900 px-2"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setPendingClear(false)}
                  className="text-sm text-gray-500 hover:text-gray-700 px-2"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleClear}
                className="text-sm text-red-600 hover:text-red-800 flex items-center gap-1"
                title="Clear all strokes"
              >
                <FiTrash2 className="h-4 w-4" /> Clear
              </button>
            )}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              <FiSave className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <div className="mb-3 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={`w-6 h-6 rounded-full border-2 ${
                    color === c ? 'border-gray-900 dark:border-white scale-110' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <label className="text-xs flex items-center gap-2">
              <span className="text-gray-500">Width</span>
              <input
                type="range"
                min={1}
                max={20}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
              <span className="font-mono w-6 text-right">{width}</span>
            </label>
            <span className="ml-auto text-xs text-gray-500">
              {strokes.length} stroke{strokes.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded p-3 inline-block">
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="border border-gray-300 bg-white rounded cursor-crosshair touch-none"
              style={{ touchAction: 'none' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
