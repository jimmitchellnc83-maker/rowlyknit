import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FiArrowDown,
  FiArrowUp,
  FiPlus,
  FiSave,
  FiTrash2,
  FiX,
} from 'react-icons/fi';
import { Document, Page } from 'react-pdf';
import { toast } from 'react-toastify';
import {
  listCropsForPattern,
  sourceFileBytesUrl,
  type PatternCrop,
} from '../../lib/sourceFiles';
import {
  updateJoinLayout,
  type JoinLayout,
  type JoinRegion,
} from '../../lib/wave6';
import '../../lib/pdfjsWorker';

interface Props {
  projectId: string;
  layout: JoinLayout;
  /** Pattern IDs whose crops can be added to this layout. The project's
   *  attached patterns. Empty array → editor shows an explanatory empty
   *  state instead of "no crops" silence. */
  patternIds: string[];
  onClose: () => void;
  onSaved: (layout: JoinLayout) => void;
}

interface AvailableCrop extends PatternCrop {
  patternId: string;
}

interface DragState {
  index: number;
  /** Whether we're moving the whole region (translate) or resizing
   *  from one corner. Resize handles all change width and/or height
   *  while keeping the opposite corner pinned. */
  mode: 'move' | 'resize-se' | 'resize-sw' | 'resize-ne' | 'resize-nw';
  /** Pointer offset within the region at drag-start, normalized 0..1.
   *  We add this back so the rectangle doesn't jump under the finger. */
  pointerDx: number;
  pointerDy: number;
  /** Original geometry — kept so resize math reads from a stable
   *  baseline instead of the just-mutated state. */
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

/**
 * Wave 6 — visual region editor for join layouts. The user can:
 *   - drag crops onto a layout canvas (Add button on the left panel)
 *   - move regions by dragging
 *   - resize regions by dragging any corner handle
 *   - reorder layers via up/down buttons (front/back)
 *   - tweak coords numerically in an "advanced" details panel
 *
 * Coords are normalized 0..1 against the canvas. The canvas itself
 * shows at a fixed aspect (4:3, ~800px wide) so layouts authored on
 * desktop look right when the user later prints / shares.
 *
 * Mobile/tablet: pointer events with `touchAction: 'none'` so finger
 * drags don't trigger page scroll. Resize handles are 24×24px (the
 * minimum tap target the iOS HIG calls comfortable) and grow further
 * with a 28×28 hit-area ring so they're easy to land on a tablet.
 */
export default function JoinLayoutEditor({
  projectId,
  layout,
  patternIds,
  onClose,
  onSaved,
}: Props) {
  const [available, setAvailable] = useState<AvailableCrop[]>([]);
  const [regions, setRegions] = useState<JoinRegion[]>(
    [...layout.regions].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
  );
  const [name, setName] = useState<string>(layout.name);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const canvasRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      patternIds.map(async (pid) => {
        const crops = await listCropsForPattern(pid).catch(() => []);
        return crops.map((c) => ({ ...c, patternId: pid }));
      }),
    )
      .then((arrays) => {
        if (cancelled) return;
        setAvailable(arrays.flat());
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patternIds]);

  const cropsById = useMemo(
    () => new Map(available.map((c) => [c.id, c])),
    [available],
  );

  function clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  function pointToNormalized(clientX: number, clientY: number): {
    x: number;
    y: number;
  } | null {
    const el = canvasRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    };
  }

  function handleAdd(crop: AvailableCrop) {
    setRegions((prev) => {
      const next = [
        ...prev,
        {
          patternCropId: crop.id,
          x: 0.05,
          y: 0.05,
          width: 0.4,
          height: 0.4,
          zIndex: prev.length,
        },
      ];
      return next;
    });
    setActiveIndex(regions.length);
  }

  function handleRemove(idx: number) {
    setRegions((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((r, i) => ({ ...r, zIndex: i })),
    );
    setActiveIndex(null);
  }

  function handleReorder(idx: number, dir: -1 | 1) {
    setRegions((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((r, i) => ({ ...r, zIndex: i }));
    });
    setActiveIndex(idx + dir);
  }

  function handleField(idx: number, key: keyof JoinRegion, value: string) {
    const v = Number(value);
    if (!Number.isFinite(v)) return;
    setRegions((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: clamp01(v) } : r)),
    );
  }

  function handleRegionPointerDown(
    idx: number,
    mode: DragState['mode'],
    e: React.PointerEvent<HTMLDivElement>,
  ) {
    if (e.button !== undefined && e.button !== 0) return;
    e.stopPropagation();
    const p = pointToNormalized(e.clientX, e.clientY);
    if (!p) return;
    const r = regions[idx];
    setActiveIndex(idx);
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    setDrag({
      index: idx,
      mode,
      pointerDx: p.x - r.x,
      pointerDy: p.y - r.y,
      startX: r.x,
      startY: r.y,
      startW: r.width,
      startH: r.height,
    });
  }

  function handleCanvasPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    const p = pointToNormalized(e.clientX, e.clientY);
    if (!p) return;
    setRegions((prev) =>
      prev.map((r, i) => {
        if (i !== drag.index) return r;
        if (drag.mode === 'move') {
          const newX = clamp01(p.x - drag.pointerDx);
          const newY = clamp01(p.y - drag.pointerDy);
          // Don't let the move drag the rectangle off the canvas edges.
          return {
            ...r,
            x: Math.min(newX, 1 - r.width),
            y: Math.min(newY, 1 - r.height),
          };
        }
        // Resize: keep the opposite corner pinned to its original spot
        // and let the user drag the named corner under the pointer.
        const right = drag.startX + drag.startW;
        const bottom = drag.startY + drag.startH;
        let nx = r.x;
        let ny = r.y;
        let nw = r.width;
        let nh = r.height;
        const minSize = 0.04; // ~4% of the canvas
        if (drag.mode === 'resize-se') {
          nw = clamp01(p.x - drag.startX);
          nh = clamp01(p.y - drag.startY);
        } else if (drag.mode === 'resize-sw') {
          nx = clamp01(p.x);
          nw = clamp01(right - nx);
          nh = clamp01(p.y - drag.startY);
        } else if (drag.mode === 'resize-ne') {
          ny = clamp01(p.y);
          nw = clamp01(p.x - drag.startX);
          nh = clamp01(bottom - ny);
        } else if (drag.mode === 'resize-nw') {
          nx = clamp01(p.x);
          ny = clamp01(p.y);
          nw = clamp01(right - nx);
          nh = clamp01(bottom - ny);
        }
        if (nw < minSize) nw = minSize;
        if (nh < minSize) nh = minSize;
        if (nx + nw > 1) nx = 1 - nw;
        if (ny + nh > 1) ny = 1 - nh;
        return { ...r, x: nx, y: ny, width: nw, height: nh };
      }),
    );
  }

  function handleCanvasPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag) return;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    setDrag(null);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const stamped = regions.map((r, i) => ({ ...r, zIndex: i }));
      const saved = await updateJoinLayout(projectId, layout.id, {
        name: name.trim() || layout.name,
        regions: stamped,
      });
      toast.success('Layout saved.');
      onSaved(saved);
    } catch {
      toast.error('Failed to save layout. Check region values stay in 0..1.');
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
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-3 sm:px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="font-semibold text-lg bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500 px-2 py-2 min-h-[44px] flex-1 min-w-0"
            aria-label="Layout name"
          />
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 min-h-[44px]"
            >
              <FiSave className="h-4 w-4" />
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close editor"
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4 p-3 sm:p-4">
          {/* Available crops */}
          <div className="space-y-2 md:max-h-[75vh] md:overflow-y-auto">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Available crops
            </h5>
            {patternIds.length === 0 && (
              <p className="text-xs text-gray-500">
                Attach a pattern to this project to use its crops here.
              </p>
            )}
            {loading ? (
              <p className="text-xs text-gray-500">Loading crops…</p>
            ) : available.length === 0 ? (
              <p className="text-xs text-gray-500 italic">
                No crops on this project's patterns yet. Open a pattern, drag a crop on a PDF page, save it, then come back.
              </p>
            ) : (
              <ul className="space-y-1">
                {available.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm"
                  >
                    <span className="truncate min-w-0">
                      {c.label ?? <em className="text-gray-400">unlabeled</em>}
                      <span className="ml-2 text-xs text-gray-500">p{c.pageNumber}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAdd(c)}
                      className="rounded-lg bg-purple-600 text-white text-sm px-3 py-2 hover:bg-purple-700 flex items-center gap-1.5 flex-shrink-0 min-h-[36px]"
                      aria-label={`Add ${c.label ?? 'crop'} to layout`}
                    >
                      <FiPlus className="h-4 w-4" /> Add
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Layer / region controls — appear once a region exists */}
            {regions.length > 0 && (
              <div className="mt-4">
                <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
                  Regions ({regions.length})
                </h5>
                <ul className="space-y-1">
                  {regions.map((r, idx) => {
                    const crop = cropsById.get(r.patternCropId);
                    const isActive = activeIndex === idx;
                    return (
                      <li
                        key={`${r.patternCropId}-${idx}`}
                        className={`rounded border px-2 py-1 text-xs ${
                          isActive
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveIndex(idx)}
                          className="block w-full text-left mb-1 truncate"
                        >
                          {crop?.label ?? <em className="text-gray-400">crop</em>}
                          {crop && (
                            <span className="ml-2 text-gray-500">
                              p{crop.pageNumber}
                            </span>
                          )}
                        </button>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleReorder(idx, -1)}
                              disabled={idx === 0}
                              aria-label="Send back"
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <FiArrowUp className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReorder(idx, 1)}
                              disabled={idx === regions.length - 1}
                              aria-label="Bring forward"
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:hover:bg-transparent"
                            >
                              <FiArrowDown className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemove(idx)}
                              aria-label="Remove region"
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        <details className="mt-1">
                          <summary className="cursor-pointer text-[10px] text-gray-500">
                            Numeric (advanced)
                          </summary>
                          <div className="mt-1 grid grid-cols-4 gap-1">
                            <NumField label="x" value={r.x} onChange={(v) => handleField(idx, 'x', v)} />
                            <NumField label="y" value={r.y} onChange={(v) => handleField(idx, 'y', v)} />
                            <NumField label="w" value={r.width} onChange={(v) => handleField(idx, 'width', v)} />
                            <NumField label="h" value={r.height} onChange={(v) => handleField(idx, 'height', v)} />
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* Visual canvas */}
          <div>
            <p className="text-xs text-gray-500 mb-2">
              Drag a region to move it. Drag a corner to resize. Use the layer arrows to send a region back or bring it forward.
            </p>
            <div
              ref={canvasRef}
              onPointerMove={handleCanvasPointerMove}
              onPointerUp={handleCanvasPointerUp}
              onPointerCancel={handleCanvasPointerUp}
              onPointerDown={() => setActiveIndex(null)}
              data-testid="join-layout-canvas"
              className="relative w-full bg-white dark:bg-gray-100 border border-gray-300 dark:border-gray-700 rounded shadow-inner"
              style={{
                aspectRatio: '4 / 3',
                touchAction: 'none',
              }}
            >
              {regions.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400 pointer-events-none">
                  Click "Add" on a crop to drop it onto the canvas.
                </div>
              )}
              {regions.map((r, idx) => {
                const crop = cropsById.get(r.patternCropId);
                const isActive = activeIndex === idx;
                return (
                  <div
                    key={`${r.patternCropId}-${idx}`}
                    onPointerDown={(e) => handleRegionPointerDown(idx, 'move', e)}
                    style={{
                      position: 'absolute',
                      left: `${r.x * 100}%`,
                      top: `${r.y * 100}%`,
                      width: `${r.width * 100}%`,
                      height: `${r.height * 100}%`,
                      zIndex: idx + 1,
                      cursor: drag?.index === idx && drag.mode === 'move' ? 'grabbing' : 'grab',
                      touchAction: 'none',
                    }}
                    className={`overflow-hidden bg-white dark:bg-gray-50 rounded shadow border-2 ${
                      isActive ? 'border-blue-500' : 'border-gray-300'
                    }`}
                  >
                    {crop ? (
                      <CropPreviewSurface crop={crop} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs text-gray-400">
                        crop missing
                      </div>
                    )}
                    {/* Label tag — visible at top-left corner */}
                    {crop?.label && (
                      <span className="absolute top-0 left-0 bg-blue-600 text-white text-[10px] px-1 py-0.5 rounded-br pointer-events-none truncate max-w-[80%]">
                        {crop.label}
                      </span>
                    )}
                    {/* Resize handles — corners. Only the active region's
                         handles are visible to keep the canvas calm. */}
                    {isActive && (
                      <>
                        <ResizeHandle
                          position="nw"
                          onPointerDown={(e) => handleRegionPointerDown(idx, 'resize-nw', e)}
                        />
                        <ResizeHandle
                          position="ne"
                          onPointerDown={(e) => handleRegionPointerDown(idx, 'resize-ne', e)}
                        />
                        <ResizeHandle
                          position="sw"
                          onPointerDown={(e) => handleRegionPointerDown(idx, 'resize-sw', e)}
                        />
                        <ResizeHandle
                          position="se"
                          onPointerDown={(e) => handleRegionPointerDown(idx, 'resize-se', e)}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function NumField(props: {
  label: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <label className="text-[10px]">
      <span className="block text-gray-500">{props.label}</span>
      <input
        type="number"
        step={0.01}
        min={0}
        max={1}
        value={Number(props.value.toFixed(3))}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-0.5 w-full rounded border border-gray-300 dark:border-gray-700 px-1 py-0.5 text-[11px] dark:bg-gray-800 dark:text-gray-100"
      />
    </label>
  );
}

function ResizeHandle(props: {
  position: 'nw' | 'ne' | 'sw' | 'se';
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  // Visible nub is 14×14 (looks calm) but the surrounding hit area is
  // 28×28 — well past the 24px iOS HIG comfort minimum — so a finger
  // on a tablet doesn't have to chase the corner. The nub sits inside
  // a transparent 28×28 wrapper that absorbs the pointer event.
  const HIT = 28;
  const NUB = 14;
  const halfHit = HIT / 2;
  const positions: Record<typeof props.position, React.CSSProperties> = {
    nw: { top: -halfHit, left: -halfHit, cursor: 'nwse-resize' },
    ne: { top: -halfHit, right: -halfHit, cursor: 'nesw-resize' },
    sw: { bottom: -halfHit, left: -halfHit, cursor: 'nesw-resize' },
    se: { bottom: -halfHit, right: -halfHit, cursor: 'nwse-resize' },
  };
  return (
    <div
      role="button"
      aria-label={`Resize ${props.position}`}
      onPointerDown={props.onPointerDown}
      data-handle-size={HIT}
      style={{
        position: 'absolute',
        width: HIT,
        height: HIT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        touchAction: 'none',
        ...positions[props.position],
      }}
    >
      <span
        style={{
          width: NUB,
          height: NUB,
          background: '#2563eb',
          borderRadius: 3,
          border: '2px solid white',
          boxShadow: '0 0 0 1px #2563eb',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

/**
 * Renders the underlying PDF page scaled so the saved crop region
 * exactly fills the parent. Same trick as QuickKeysPanel.CropThumbnail
 * — page rendered at width = container/cropWidth, then translated up
 * and left by the crop's x/y offset.
 */
function CropPreviewSurface({ crop }: { crop: AvailableCrop }) {
  const [pageRendered, setPageRendered] = useState<{ w: number; h: number } | null>(
    null,
  );
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(200);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const safeCropW = crop.cropWidth > 0 ? crop.cropWidth : 1;
  const pageWidth = Math.max(48, Math.round(containerWidth / safeCropW));
  const offsetX = -crop.cropX * pageWidth;
  const offsetY = pageRendered ? -crop.cropY * pageRendered.h : 0;

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full overflow-hidden bg-gray-50"
      style={{ pointerEvents: 'none' }}
    >
      <Document
        file={sourceFileBytesUrl(crop.sourceFileId)}
        loading={null}
        error={
          <div className="flex items-center justify-center h-full text-xs text-gray-400">
            (preview unavailable)
          </div>
        }
      >
        <div
          style={{
            transform: `translate(${offsetX}px, ${offsetY}px)`,
            transformOrigin: 'top left',
            width: `${pageWidth}px`,
          }}
        >
          <Page
            pageNumber={crop.pageNumber}
            width={pageWidth}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            onRenderSuccess={(page) =>
              setPageRendered({ w: page.width, h: page.height })
            }
          />
        </div>
      </Document>
    </div>
  );
}
