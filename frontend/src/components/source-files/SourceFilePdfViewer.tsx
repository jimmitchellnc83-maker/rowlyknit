import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import { toast } from 'react-toastify';
import {
  FiEdit3,
  FiCheck,
  FiTrash2,
  FiRotateCcw,
  FiRotateCw,
  FiBookmark,
  FiGrid,
  FiEye,
  FiEyeOff,
} from 'react-icons/fi';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import '../../lib/pdfjsWorker';
import {
  createCrop,
  deleteCrop,
  listCropsForSourceFile,
  setCropQuickKey,
  type PatternCrop,
  type SourceFile,
  sourceFileBytesUrl,
} from '../../lib/sourceFiles';
import { trackEvent } from '../../lib/analytics';
import { dragToRect, isMeaningfulRect, pointInPage } from './cropMath';
import AnnotationLayer, { type AnnotationLayerHandle } from './AnnotationLayer';
import ChartAssistanceModal from '../wave5/ChartAssistanceModal';

/**
 * Wave 2 PR 3 — PDF viewer + crop drawing UI on top of the SourceFile
 * model. Renders pages from the auth-streamed `/api/source-files/:id/file`
 * endpoint, lets the knitter click-drag a rectangle on any page, and
 * persists it as a `pattern_crops` row scoped to the source file.
 *
 * Coords are normalized 0..1 against the rendered page size, so the
 * same crop survives a re-rasterization at a different zoom level —
 * that's the contract Waves 3/4/5/6 all consume. The page width comes
 * from the live container size (ResizeObserver), so the PDF stays
 * fluid across desktop / tablet / narrow window — no fixed 600px box
 * that overflows on a phone or under-fills a 27" monitor.
 *
 * Annotation tooling lives in a floating toolbar that pops in when the
 * user starts annotating an active crop. Big touch targets, distinct
 * pen / highlighter / eraser controls, and the per-tool settings
 * (color, width, opacity) sit in a single panel near the PDF surface
 * instead of a cramped sidebar.
 */

interface SourceFilePdfViewerProps {
  sourceFile: SourceFile;
  /** When set, newly drawn crops attach to this pattern. */
  patternId?: string;
  onCropCreated?: (crop: PatternCrop) => void;
}

type AnnotationTool = 'pen' | 'highlight' | 'eraser' | null;

interface DragRect {
  page: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

const PEN_COLORS = [
  '#7c3aed', // purple (default pen)
  '#1d4ed8', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#0f172a', // ink black
];
const HIGHLIGHT_COLORS = [
  '#facc15', // yellow (default highlight)
  '#fb923c', // orange
  '#34d399', // mint
  '#60a5fa', // sky
  '#f472b6', // pink
];

/** Per-tool default stroke widths in normalized crop units (0..1). */
const PEN_DEFAULT_WIDTH = 0.005;
const HIGHLIGHT_DEFAULT_WIDTH = 0.025;
const ERASER_DEFAULT_RADIUS = 0.02;

/**
 * Detect "Annotate page" backing crops — full-bleed (0,0,1,1) rectangles
 * created by the page-level annotation entry point. These exist purely to
 * mount AnnotationLayer over the whole page and are not real user-drawn
 * regions, so they are excluded from the crop sidebar list and rendered
 * without the loud purple bbox styling.
 */
const FULLPAGE_EPS = 1e-6;
export function isFullPageCrop(c: PatternCrop): boolean {
  return (
    Math.abs(c.cropX) < FULLPAGE_EPS &&
    Math.abs(c.cropY) < FULLPAGE_EPS &&
    Math.abs(c.cropWidth - 1) < FULLPAGE_EPS &&
    Math.abs(c.cropHeight - 1) < FULLPAGE_EPS
  );
}

/**
 * Sensible bounds for the rendered PDF page width: never tinier than
 * 320px (legibility floor on a small phone) and never wider than 900px
 * (text wraps strangely beyond that on a 27" monitor + the rendered
 * raster blows up). Padding accounts for the scroll container's px-4.
 */
function clampPageWidth(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 600;
  const usable = containerWidth - 32;
  return Math.max(320, Math.min(usable, 900));
}

export default function SourceFilePdfViewer({
  sourceFile,
  patternId,
  onCropCreated,
}: SourceFilePdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(sourceFile.pageCount ?? 0);
  const [crops, setCrops] = useState<PatternCrop[]>([]);
  const [drag, setDrag] = useState<DragRect | null>(null);
  const [savingLabel, setSavingLabel] = useState<string>('');
  const [pendingRect, setPendingRect] = useState<{
    page: number;
    cropX: number;
    cropY: number;
    cropWidth: number;
    cropHeight: number;
  } | null>(null);
  const [activeCropId, setActiveCropId] = useState<string | null>(null);
  // Sprint 2 — reading vs edit-regions mode. Default `'hidden'` is the
  // calm reading view: saved crop overlays are tucked away so the PDF
  // reads like a pattern, not a debug surface. Flip to `'visible'` to
  // see + manage every saved region (full purple boxes, labels, click
  // targets). Annotation/chart-assistance flows still surface the active
  // region regardless of mode — those are explicit edit intents.
  const [regionsMode, setRegionsMode] = useState<'hidden' | 'visible'>('hidden');
  // Wave 5 — chart assistance modal state. Stores the crop currently
  // open in the assistance UI (null = closed).
  const [chartAssistCrop, setChartAssistCrop] = useState<PatternCrop | null>(null);
  const [tool, setTool] = useState<AnnotationTool>(null);
  // Pen/highlighter colors and per-tool widths persist independently so
  // switching tools doesn't trash the user's previous setup.
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0]);
  const [highlightColor, setHighlightColor] = useState<string>(HIGHLIGHT_COLORS[0]);
  const [penWidth, setPenWidth] = useState<number>(PEN_DEFAULT_WIDTH);
  const [highlightWidth, setHighlightWidth] = useState<number>(HIGHLIGHT_DEFAULT_WIDTH);
  const [eraserRadius, setEraserRadius] = useState<number>(ERASER_DEFAULT_RADIUS);
  const annotationLayerRef = useRef<AnnotationLayerHandle | null>(null);
  const [stackCounts, setStackCounts] = useState<{ undo: number; redo: number }>({
    undo: 0,
    redo: 0,
  });
  // Outer wrapper holds the page header + PDF surface together so jumpToPage
  // scrolls to the page label. Inner refs point at the PDF-only coordinate
  // surface — pointer math, overlays, AnnotationLayer, and chart-assistance
  // alignment all read this so the page header sits outside the unit square.
  const pageWrapperRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pdfSurfaceRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  /** Container that ResizeObserver watches — its width drives the PDF
   *  page render width so pages reflow on viewport resize. */
  const pdfScrollRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(600);
  const targetPageWidth = useMemo(
    () => clampPageWidth(containerWidth),
    [containerWidth],
  );

  useEffect(() => {
    const el = pdfScrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // Seed once so the first paint isn't stuck at the default.
    setContainerWidth(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      if (w > 0) setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fileUrl = useMemo(() => sourceFileBytesUrl(sourceFile.id), [sourceFile.id]);

  // Initial crop list
  useEffect(() => {
    let cancelled = false;
    listCropsForSourceFile(sourceFile.id)
      .then((rows) => {
        if (!cancelled) setCrops(rows);
      })
      .catch(() => {
        // Toast happens at the action layer; here a missing list is
        // recoverable (the user can refresh).
      });
    return () => {
      cancelled = true;
    };
  }, [sourceFile.id]);

  function handleDocumentLoad({ numPages: n }: { numPages: number }) {
    setNumPages(n);
  }

  function handlePagePointerDown(page: number, e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    // Don't let crop-drag steal the gesture from an active annotation.
    if (tool && activeCropId) return;
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const point = pointInPage(target.getBoundingClientRect(), {
      x: e.clientX,
      y: e.clientY,
    });
    if (!point) return;
    setDrag({ page, startX: point.x, startY: point.y, currentX: point.x, currentY: point.y });
  }

  function handlePagePointerMove(page: number, e: React.PointerEvent<HTMLDivElement>) {
    if (!drag || drag.page !== page) return;
    const point = pointInPage(e.currentTarget.getBoundingClientRect(), {
      x: e.clientX,
      y: e.clientY,
    });
    if (!point) return;
    setDrag({ ...drag, currentX: point.x, currentY: point.y });
  }

  function handlePagePointerUp(page: number, e: React.PointerEvent<HTMLDivElement>) {
    if (!drag || drag.page !== page) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    const rect = dragToRect(
      { x: drag.startX, y: drag.startY },
      { x: drag.currentX, y: drag.currentY }
    );
    setDrag(null);
    if (!isMeaningfulRect(rect)) return;
    setPendingRect({
      page,
      cropX: rect.x,
      cropY: rect.y,
      cropWidth: rect.width,
      cropHeight: rect.height,
    });
  }

  async function saveCrop() {
    if (!pendingRect) return;
    try {
      const crop = await createCrop(sourceFile.id, {
        pageNumber: pendingRect.page,
        cropX: pendingRect.cropX,
        cropY: pendingRect.cropY,
        cropWidth: pendingRect.cropWidth,
        cropHeight: pendingRect.cropHeight,
        label: savingLabel.trim() || null,
        patternId: patternId ?? null,
      });
      setCrops((prev) => [...prev, crop]);
      setPendingRect(null);
      setSavingLabel('');
      trackEvent('Crop Saved', { craft: sourceFile.craft, kind: sourceFile.kind });
      onCropCreated?.(crop);
      toast.success('Crop saved');
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Failed to save crop';
      toast.error(message);
    }
  }

  function cancelDraft() {
    setPendingRect(null);
    setSavingLabel('');
  }

  async function handleDeleteCrop(crop: PatternCrop) {
    try {
      await deleteCrop(sourceFile.id, crop.id);
      setCrops((prev) => prev.filter((c) => c.id !== crop.id));
    } catch {
      toast.error('Failed to delete crop');
    }
  }

  async function handleToggleQuickKey(crop: PatternCrop) {
    const current = crop.isQuickKey;
    try {
      const next = !current;
      const result = await setCropQuickKey(sourceFile.id, crop.id, {
        isQuickKey: next,
        position: next ? Date.now() : null,
      });
      setCrops((prev) =>
        prev.map((c) =>
          c.id === crop.id
            ? {
                ...c,
                isQuickKey: result.isQuickKey,
                quickKeyPosition: result.quickKeyPosition,
              }
            : c
        )
      );
      trackEvent('QuickKey Toggled', { isQuickKey: result.isQuickKey });
    } catch {
      toast.error('Failed to update QuickKey');
    }
  }

  function jumpToPage(page: number) {
    const ref = pageWrapperRefs.current.get(page);
    if (ref) ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Open full-page annotation for a given page. Finds (or lazily
   * creates) the page's "fullpage" crop — a (0,0,1,1) rectangle that
   * covers the whole page — and selects it. Pen/highlight/eraser then
   * draw across the entire page via the existing AnnotationLayer.
   */
  async function openFullPageAnnotation(page: number) {
    const existing = crops.find((c) => c.pageNumber === page && isFullPageCrop(c));
    if (existing) {
      setActiveCropId(existing.id);
      setTool('pen');
      return;
    }
    try {
      const crop = await createCrop(sourceFile.id, {
        pageNumber: page,
        cropX: 0,
        cropY: 0,
        cropWidth: 1,
        cropHeight: 1,
        label: `Page ${page} annotations`,
        patternId: patternId ?? null,
      });
      setCrops((prev) => [...prev, crop]);
      setActiveCropId(crop.id);
      setTool('pen');
      trackEvent('Page Annotation Opened', { page });
    } catch {
      toast.error('Could not open page annotations');
    }
  }

  const annotationActive = activeCropId !== null;
  const activeStrokeWidth =
    tool === 'highlight'
      ? highlightWidth
      : tool === 'eraser'
        ? eraserRadius
        : penWidth;
  const activeColor = tool === 'highlight' ? highlightColor : penColor;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full min-h-0 relative">
      {/* PDF surface — fluid width via ResizeObserver. */}
      <div
        ref={pdfScrollRef}
        className="flex-1 min-w-0 overflow-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-2 sm:p-4"
        data-testid="pdf-scroll-container"
      >
        <Document
          file={fileUrl}
          onLoadSuccess={handleDocumentLoad}
          loading={<div className="text-center py-8 text-gray-500">Loading PDF…</div>}
          error={<div className="text-center py-8 text-red-600">Failed to load PDF</div>}
        >
          {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNumber) => (
            <div
              key={pageNumber}
              ref={(el) => {
                if (el) pageWrapperRefs.current.set(pageNumber, el);
              }}
              data-testid={`pdf-page-${pageNumber}`}
              className="mb-4 select-none"
            >
              {/* Page header — sits OUTSIDE the PDF coordinate surface so
                  pointer math, overlays, and the AnnotationLayer never
                  see the header's pixels. */}
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500">Page {pageNumber}</span>
                <button
                  type="button"
                  onClick={() => {
                    void openFullPageAnnotation(pageNumber);
                  }}
                  className="inline-flex items-center gap-1 text-xs sm:text-sm rounded bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-200 px-3 py-2 font-medium min-h-[44px]"
                  title="Annotate the whole page (pen, highlight, eraser)"
                >
                  <FiEdit3 className="h-4 w-4" />
                  Annotate page
                </button>
              </div>
              {/* PDF coordinate surface — the only element the pointer
                  handlers and overlays talk to. getBoundingClientRect()
                  on this div returns PDF-only pixels, so a crop drawn at
                  the top of the visible PDF starts at y=0. */}
              <div
                ref={(el) => {
                  if (el) pdfSurfaceRefs.current.set(pageNumber, el);
                }}
                data-testid={`pdf-surface-${pageNumber}`}
                className="relative inline-block max-w-full"
                onPointerDown={(e) => handlePagePointerDown(pageNumber, e)}
                onPointerMove={(e) => handlePagePointerMove(pageNumber, e)}
                onPointerUp={(e) => handlePagePointerUp(pageNumber, e)}
                style={{ touchAction: 'none' }}
              >
                <Page pageNumber={pageNumber} width={targetPageWidth} />
                {/* Saved crops on this page.
                    Mode rules:
                      - Fullpage crops back "Annotate page" → render an
                        invisible wrapper so AnnotationLayer can still
                        mount; never show bbox styling.
                      - Reading mode (`regionsMode === 'hidden'`) → only
                        render the *active* crop's wrapper and even then
                        with a soft outline; other saved crops are tucked
                        away so the PDF reads cleanly.
                      - Edit mode (`regionsMode === 'visible'`) →
                        full purple bboxes, labels, click-to-select.
                    Active+annotating always shows the bright bbox so the
                    user knows where they are drawing. */}
                {crops
                  .filter((c) => c.pageNumber === pageNumber)
                  .map((c) => {
                    const isActive = activeCropId === c.id;
                    const isFullpage = isFullPageCrop(c);
                    const editing = regionsMode === 'visible';
                    const showLoudBbox =
                      !isFullpage && (editing || (isActive && tool !== null));
                    const showSoftBbox =
                      !isFullpage && !showLoudBbox && isActive && !tool;
                    let wrapperClass: string;
                    if (isFullpage) {
                      wrapperClass = 'absolute pointer-events-none';
                    } else if (showLoudBbox) {
                      wrapperClass = `absolute border-2 ${
                        isActive
                          ? 'border-purple-700 bg-purple-200 bg-opacity-15'
                          : 'border-purple-500 bg-purple-200 bg-opacity-25'
                      }`;
                    } else if (showSoftBbox) {
                      wrapperClass =
                        'absolute border border-dashed border-purple-400/70 bg-transparent';
                    } else {
                      // Reading mode, not active: no bbox — wrapper is a
                      // zero-style absolute box so AnnotationLayer (only
                      // mounted when isActive anyway) still has a parent.
                      wrapperClass = 'absolute pointer-events-none';
                    }
                    const interactive = !isFullpage && editing && !tool;
                    const showLabel = showLoudBbox && c.label && !isFullpage;
                    const showTitleAttr = !isFullpage && c.label;
                    return (
                      <div
                        key={c.id}
                        className={wrapperClass}
                        data-testid={`crop-overlay-${c.id}`}
                        data-fullpage={isFullpage ? 'true' : 'false'}
                        data-loud={showLoudBbox ? 'true' : 'false'}
                        title={showTitleAttr ? (c.label as string) : undefined}
                        style={{
                          left: `${c.cropX * 100}%`,
                          top: `${c.cropY * 100}%`,
                          width: `${c.cropWidth * 100}%`,
                          height: `${c.cropHeight * 100}%`,
                          pointerEvents: interactive ? 'auto' : 'none',
                        }}
                        onClick={(e) => {
                          if (!interactive) return;
                          e.stopPropagation();
                          setActiveCropId(isActive ? null : c.id);
                        }}
                      >
                        {showLabel ? (
                          <span className="absolute -top-5 left-0 text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded pointer-events-none">
                            {c.label}
                          </span>
                        ) : null}
                        {isActive ? (
                          <AnnotationLayer
                            ref={annotationLayerRef}
                            sourceFileId={sourceFile.id}
                            cropId={c.id}
                            tool={tool}
                            color={activeColor}
                            strokeWidth={activeStrokeWidth}
                            onStackChange={setStackCounts}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                {/* Active drag preview */}
                {drag && drag.page === pageNumber ? (
                  <div
                    className="absolute border-2 border-dashed border-purple-700 bg-purple-300 bg-opacity-30 pointer-events-none"
                    style={{
                      left: `${Math.min(drag.startX, drag.currentX) * 100}%`,
                      top: `${Math.min(drag.startY, drag.currentY) * 100}%`,
                      width: `${Math.abs(drag.currentX - drag.startX) * 100}%`,
                      height: `${Math.abs(drag.currentY - drag.startY) * 100}%`,
                    }}
                  />
                ) : null}
                {/* Pending rect (not yet saved) */}
                {pendingRect && pendingRect.page === pageNumber ? (
                  <div
                    className="absolute border-2 border-orange-500 bg-orange-200 bg-opacity-30 pointer-events-none"
                    style={{
                      left: `${pendingRect.cropX * 100}%`,
                      top: `${pendingRect.cropY * 100}%`,
                      width: `${pendingRect.cropWidth * 100}%`,
                      height: `${pendingRect.cropHeight * 100}%`,
                    }}
                  />
                ) : null}
              </div>
            </div>
          ))}
        </Document>
      </div>

      {/* Side panel — full-width on narrow viewports (stacks below PDF),
          fixed-width column on lg+. Holds the regions-mode toggle, the
          new-crop label form, and the saved-crops list grouped by page.
          Annotation tooling lives in the floating toolbar so the user
          has one focused place to look during a stroke. */}
      <aside className="lg:w-72 lg:flex-shrink-0 flex flex-col gap-3">
        {pendingRect ? (
          <div className="rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-900/20 p-3">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              New crop on page {pendingRect.page}
            </p>
            <input
              type="text"
              autoFocus
              placeholder="Label (optional)"
              value={savingLabel}
              onChange={(e) => setSavingLabel(e.target.value)}
              className="mt-2 w-full rounded border border-gray-300 px-3 py-2 text-sm min-h-[44px]"
              maxLength={120}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={saveCrop}
                className="flex-1 rounded bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700 min-h-[44px]"
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelDraft}
                className="rounded border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <CropSidebar
          crops={crops}
          activeCropId={activeCropId}
          regionsMode={regionsMode}
          onToggleRegionsMode={() =>
            setRegionsMode((m) => (m === 'hidden' ? 'visible' : 'hidden'))
          }
          onJumpToCrop={(c) => {
            jumpToPage(c.pageNumber);
            setActiveCropId(c.id);
          }}
          onToggleQuickKey={handleToggleQuickKey}
          onChartAssist={(c) => setChartAssistCrop(c)}
          onDeleteCrop={handleDeleteCrop}
        />
      </aside>

      {/* Floating annotation toolbar — appears only when an annotation
          crop is active. Sits above the global mobile bottom nav (which
          is `h-20` on `md:hidden`) so it stays reachable. Big touch
          targets, separate per-tool settings, clear active states. */}
      {annotationActive && (
        <FloatingAnnotationToolbar
          tool={tool}
          onToolChange={setTool}
          penColor={penColor}
          highlightColor={highlightColor}
          onPenColor={setPenColor}
          onHighlightColor={setHighlightColor}
          penWidth={penWidth}
          highlightWidth={highlightWidth}
          eraserRadius={eraserRadius}
          onPenWidth={setPenWidth}
          onHighlightWidth={setHighlightWidth}
          onEraserRadius={setEraserRadius}
          stackCounts={stackCounts}
          onUndo={() => void annotationLayerRef.current?.undo()}
          onRedo={() => void annotationLayerRef.current?.redo()}
          onDone={() => {
            setActiveCropId(null);
            setTool(null);
          }}
        />
      )}

      {chartAssistCrop && (
        <ChartAssistanceModal
          sourceFileId={sourceFile.id}
          crop={chartAssistCrop}
          onClose={() => setChartAssistCrop(null)}
        />
      )}
    </div>
  );
}

interface FloatingToolbarProps {
  tool: AnnotationTool;
  onToolChange: (t: AnnotationTool) => void;
  penColor: string;
  highlightColor: string;
  onPenColor: (c: string) => void;
  onHighlightColor: (c: string) => void;
  penWidth: number;
  highlightWidth: number;
  eraserRadius: number;
  onPenWidth: (w: number) => void;
  onHighlightWidth: (w: number) => void;
  onEraserRadius: (r: number) => void;
  stackCounts: { undo: number; redo: number };
  onUndo: () => void;
  onRedo: () => void;
  onDone: () => void;
}

/**
 * Floating bottom toolbar for annotation. Single focused control
 * surface that hovers near the PDF instead of being tucked into a
 * small sidebar. Big 44x44+ touch targets, segmented tool selector,
 * per-tool settings inline.
 */
function FloatingAnnotationToolbar(props: FloatingToolbarProps) {
  const {
    tool,
    onToolChange,
    penColor,
    highlightColor,
    onPenColor,
    onHighlightColor,
    penWidth,
    highlightWidth,
    eraserRadius,
    onPenWidth,
    onHighlightWidth,
    onEraserRadius,
    stackCounts,
    onUndo,
    onRedo,
    onDone,
  } = props;
  const drawing = tool === 'pen' || tool === 'highlight';
  return (
    <div
      role="toolbar"
      aria-label="Annotation tools"
      className="fixed left-1/2 -translate-x-1/2 z-40 bottom-24 md:bottom-6 max-w-[calc(100vw-1.5rem)] w-auto rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border border-gray-200 dark:border-gray-700 px-3 py-2 sm:px-4 sm:py-3 flex flex-col gap-2 sm:gap-3"
      data-testid="annotation-toolbar"
    >
      {/* Tool selector — segmented control with large hit targets. */}
      <div
        role="group"
        aria-label="Tool"
        className="flex items-center gap-1 sm:gap-2"
      >
        <ToolButton
          label="Pen"
          icon={<FiEdit3 className="h-5 w-5" />}
          active={tool === 'pen'}
          activeClass="bg-purple-600 text-white border-purple-600"
          onClick={() => onToolChange(tool === 'pen' ? null : 'pen')}
        />
        <ToolButton
          label="Highlight"
          icon={<HighlighterIcon />}
          active={tool === 'highlight'}
          activeClass="bg-yellow-500 text-white border-yellow-500"
          onClick={() => onToolChange(tool === 'highlight' ? null : 'highlight')}
        />
        <ToolButton
          label="Eraser"
          icon={<EraserIcon />}
          active={tool === 'eraser'}
          activeClass="bg-red-600 text-white border-red-600"
          onClick={() => onToolChange(tool === 'eraser' ? null : 'eraser')}
        />
        <span className="hidden sm:inline-block w-px h-8 bg-gray-200 dark:bg-gray-700 mx-1" />
        <button
          type="button"
          onClick={onUndo}
          disabled={stackCounts.undo === 0}
          aria-label={`Undo (${stackCounts.undo})`}
          title="Undo"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <FiRotateCcw className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={stackCounts.redo === 0}
          aria-label={`Redo (${stackCounts.redo})`}
          title="Redo"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <FiRotateCw className="h-5 w-5" />
        </button>
        <span className="hidden sm:inline-block w-px h-8 bg-gray-200 dark:bg-gray-700 mx-1" />
        <button
          type="button"
          onClick={onDone}
          className="min-h-[44px] inline-flex items-center justify-center rounded-lg bg-gray-900 text-white px-3 sm:px-4 hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
          aria-label="Done annotating"
        >
          <FiCheck className="h-5 w-5 sm:mr-1.5" />
          <span className="hidden sm:inline text-sm font-medium">Done</span>
        </button>
      </div>

      {/* Per-tool settings: color + size for pen / highlight; size only
          for eraser. Hidden when no drawing tool is active so the row
          collapses to just the tool selector + undo/redo/done. */}
      {(drawing || tool === 'eraser') && (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 border-t border-gray-100 dark:border-gray-800 pt-2">
          {drawing && (
            <div
              role="group"
              aria-label="Color"
              className="flex items-center gap-1"
            >
              {(tool === 'highlight' ? HIGHLIGHT_COLORS : PEN_COLORS).map((c) => {
                const selected = (tool === 'highlight' ? highlightColor : penColor) === c;
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Use color ${c}`}
                    aria-pressed={selected}
                    onClick={() =>
                      tool === 'highlight' ? onHighlightColor(c) : onPenColor(c)
                    }
                    className={`h-9 w-9 sm:h-10 sm:w-10 rounded-full border-2 transition ${
                      selected
                        ? 'border-gray-900 dark:border-white scale-110 shadow-sm'
                        : 'border-transparent'
                    }`}
                    style={{ background: c }}
                  />
                );
              })}
            </div>
          )}
          <div className="flex items-center gap-2 flex-1 min-w-[160px]">
            <label
              htmlFor="annotation-stroke-size"
              className="text-[11px] uppercase tracking-wide text-gray-500 whitespace-nowrap"
            >
              {tool === 'eraser' ? 'Eraser size' : tool === 'highlight' ? 'Marker' : 'Pen'}
            </label>
            <input
              id="annotation-stroke-size"
              type="range"
              min={tool === 'highlight' ? 5 : tool === 'eraser' ? 5 : 1}
              max={tool === 'highlight' ? 60 : tool === 'eraser' ? 80 : 30}
              value={Math.round(
                (tool === 'highlight'
                  ? highlightWidth
                  : tool === 'eraser'
                    ? eraserRadius
                    : penWidth) * 1000,
              )}
              onChange={(e) => {
                const v = Number(e.target.value) / 1000;
                if (tool === 'highlight') onHighlightWidth(v);
                else if (tool === 'eraser') onEraserRadius(v);
                else onPenWidth(v);
              }}
              className="flex-1 h-2 accent-purple-600"
              aria-label={
                tool === 'eraser'
                  ? 'Eraser radius'
                  : tool === 'highlight'
                    ? 'Highlighter width'
                    : 'Pen width'
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ToolButton(props: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  activeClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.active}
      aria-label={props.label}
      title={props.label}
      className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center gap-1 rounded-lg border-2 px-2 sm:px-3 transition ${
        props.active
          ? props.activeClass
          : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
      }`}
    >
      {props.icon}
      <span className="hidden md:inline text-sm font-medium">{props.label}</span>
    </button>
  );
}

function HighlighterIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 11l-4 4v3h3l4-4" />
      <path d="M14 6l4 4-7 7-4-4z" />
      <path d="M3 21h18" />
    </svg>
  );
}

interface CropSidebarProps {
  crops: PatternCrop[];
  activeCropId: string | null;
  regionsMode: 'hidden' | 'visible';
  onToggleRegionsMode: () => void;
  onJumpToCrop: (c: PatternCrop) => void;
  onToggleQuickKey: (c: PatternCrop) => void;
  onChartAssist: (c: PatternCrop) => void;
  onDeleteCrop: (c: PatternCrop) => void;
}

/**
 * Sprint 2 — saved-crop sidebar. Groups crops by page (subheader per
 * page), filters out the full-page "Annotate page" backing crops so
 * those don't masquerade as user regions in the list, surfaces them
 * instead as a per-page "Annotated" badge, and exposes the
 * regions-mode toggle as a top-level control. Action buttons run at
 * 44×44 minimum so they're tappable on iPad/PWA.
 */
function CropSidebar({
  crops,
  activeCropId,
  regionsMode,
  onToggleRegionsMode,
  onJumpToCrop,
  onToggleQuickKey,
  onChartAssist,
  onDeleteCrop,
}: CropSidebarProps) {
  // Split user-drawn crops from full-page annotation backing crops.
  // Real crops feed the grouped list; annotated pages feed the per-page
  // "Annotated" badge so the sidebar still surfaces that the user has
  // page-level annotations without dumping a fake "Page N annotations"
  // entry in among the real regions.
  const realCrops = crops.filter((c) => !isFullPageCrop(c));
  const annotatedPages = new Set(
    crops.filter((c) => isFullPageCrop(c)).map((c) => c.pageNumber),
  );

  // Group real crops by page in ascending order; preserve creation order
  // within a page (the API already returns them sorted by created_at).
  const groupedByPage: Map<number, PatternCrop[]> = new Map();
  for (const c of realCrops) {
    const list = groupedByPage.get(c.pageNumber) ?? [];
    list.push(c);
    groupedByPage.set(c.pageNumber, list);
  }
  const pageNumbers = Array.from(groupedByPage.keys()).sort((a, b) => a - b);
  const editing = regionsMode === 'visible';

  return (
    <div
      data-testid="crop-sidebar"
      className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 lg:max-h-[calc(100vh-12rem)] lg:overflow-auto flex flex-col gap-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          Crops ({realCrops.length})
        </h3>
        <button
          type="button"
          onClick={onToggleRegionsMode}
          aria-pressed={editing}
          data-testid="regions-mode-toggle"
          data-mode={regionsMode}
          title={editing ? 'Hide regions on the page' : 'Show regions on the page'}
          className={`min-h-[44px] inline-flex items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition ${
            editing
              ? 'border-purple-600 bg-purple-600 text-white hover:bg-purple-700'
              : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {editing ? (
            <>
              <FiEyeOff className="h-4 w-4" />
              Done editing
            </>
          ) : (
            <>
              <FiEye className="h-4 w-4" />
              Edit regions
            </>
          )}
        </button>
      </div>

      {realCrops.length === 0 ? (
        <p className="text-xs text-gray-500">
          {annotatedPages.size > 0
            ? 'No regions yet. Drag a rectangle on a page to mark one — page-level annotations live above each page.'
            : 'Drag a rectangle on a page to mark a region, or use the "Annotate page" button above each page to draw on the whole page.'}
        </p>
      ) : (
        <div className="space-y-3">
          {pageNumbers.map((pageNumber) => {
            const list = groupedByPage.get(pageNumber) ?? [];
            const annotated = annotatedPages.has(pageNumber);
            return (
              <section key={pageNumber} data-testid={`crop-group-${pageNumber}`}>
                <header className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Page {pageNumber}
                  </span>
                  {annotated ? (
                    <span
                      className="rounded bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-200"
                      title="This page has annotations from the Annotate page button"
                    >
                      Annotated
                    </span>
                  ) : null}
                </header>
                <ul className="space-y-1">
                  {list.map((c) => {
                    const isQK = c.isQuickKey;
                    const isActive = activeCropId === c.id;
                    const labelDisplay =
                      c.label && c.label.trim().length > 0
                        ? c.label
                        : 'Unlabeled region';
                    return (
                      <li
                        key={c.id}
                        data-testid={`crop-item-${c.id}`}
                        className={`flex items-start gap-1 rounded px-2 py-1.5 text-sm ${
                          isActive
                            ? 'bg-purple-50 dark:bg-purple-900/20'
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onJumpToCrop(c)}
                          title={labelDisplay}
                          className="flex-1 text-left min-w-0 min-h-[44px] py-1 px-1 rounded hover:bg-white/40 dark:hover:bg-black/20"
                        >
                          <span
                            className={`block break-words ${
                              c.label
                                ? 'text-gray-900 dark:text-gray-100'
                                : 'italic text-gray-500'
                            }`}
                          >
                            {labelDisplay}
                          </span>
                          {isQK ? (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-yellow-700 dark:text-yellow-300">
                              <FiBookmark className="h-3 w-3 fill-current" />
                              QuickKey
                            </span>
                          ) : null}
                        </button>
                        <div className="flex items-center flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => onToggleQuickKey(c)}
                            className={`min-h-[44px] min-w-[44px] flex items-center justify-center rounded ${
                              isQK
                                ? 'text-yellow-500'
                                : 'text-gray-400 hover:text-yellow-500'
                            }`}
                            aria-label={isQK ? 'Remove from QuickKeys' : 'Save as QuickKey'}
                            title={isQK ? 'Remove from QuickKeys' : 'Save as QuickKey'}
                          >
                            <FiBookmark
                              className={`h-4 w-4 ${isQK ? 'fill-current' : ''}`}
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => onChartAssist(c)}
                            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-blue-600 hover:text-blue-800"
                            aria-label="Open chart assistance"
                            title="Align grid + Magic Marker"
                          >
                            <FiGrid className="h-4 w-4" />
                          </button>
                          {editing ? (
                            <button
                              type="button"
                              onClick={() => onDeleteCrop(c)}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded text-red-600 hover:text-red-800"
                              aria-label="Delete crop"
                              title="Delete crop"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** No `FiEraser` in the icon set we have, so paint our own. */
function EraserIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20 20H7L3 16C2 15 2 13 3 12L13 2L22 11L13 20" />
      <path d="M11 4L19 12" />
    </svg>
  );
}

export { clampPageWidth };
