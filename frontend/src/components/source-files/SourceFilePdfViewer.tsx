import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import { toast } from 'react-toastify';
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
 * that's the contract Waves 3/4/5/6 all consume.
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
  // Wave 5 — chart assistance modal state. Stores the crop currently
  // open in the assistance UI (null = closed).
  const [chartAssistCrop, setChartAssistCrop] = useState<PatternCrop | null>(null);
  const [tool, setTool] = useState<AnnotationTool>(null);
  // Annotation toolbar state. Pen and highlight share the same color
  // wheel so the user can pin a marker color to a project (e.g. red
  // for "rip back here") without re-picking on every stroke.
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
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0]);
  const [highlightColor, setHighlightColor] = useState<string>(HIGHLIGHT_COLORS[0]);
  /** Stroke width in normalized crop units. 0.005 = hairline; 0.025 = chunky. */
  const [strokeWidth, setStrokeWidth] = useState<number>(0.005);
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
   * Closes the user-audit gap "Full PDF annotation does not exist."
   */
  async function openFullPageAnnotation(page: number) {
    const EPS = 1e-6;
    const isFullpage = (c: PatternCrop) =>
      c.pageNumber === page &&
      Math.abs(c.cropX) < EPS &&
      Math.abs(c.cropY) < EPS &&
      Math.abs(c.cropWidth - 1) < EPS &&
      Math.abs(c.cropHeight - 1) < EPS;

    const existing = crops.find(isFullpage);
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

  return (
    <div className="flex gap-4 h-full">
      <div className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
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
                  className="text-xs rounded bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-200 px-2 py-1 font-medium"
                  title="Annotate the whole page (pen, highlight, eraser)"
                >
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
                className="relative inline-block"
                onPointerDown={(e) => handlePagePointerDown(pageNumber, e)}
                onPointerMove={(e) => handlePagePointerMove(pageNumber, e)}
                onPointerUp={(e) => handlePagePointerUp(pageNumber, e)}
                style={{ touchAction: 'none' }}
              >
                <Page pageNumber={pageNumber} width={600} />
                {/* Saved crops on this page */}
                {crops
                  .filter((c) => c.pageNumber === pageNumber)
                  .map((c) => {
                    const isActive = activeCropId === c.id;
                    // Fullpage crops back the "Annotate page" surface; we
                    // don't want them rendered as a giant purple rectangle
                    // that obscures the page. Drop the bbox styling but
                    // keep the wrapper so the AnnotationLayer can still
                    // mount over the full page area.
                    const EPS = 1e-6;
                    const isFullpage =
                      Math.abs(c.cropX) < EPS &&
                      Math.abs(c.cropY) < EPS &&
                      Math.abs(c.cropWidth - 1) < EPS &&
                      Math.abs(c.cropHeight - 1) < EPS;
                    const wrapperClass = isFullpage
                      ? 'absolute pointer-events-none'
                      : `absolute border-2 ${
                          isActive
                            ? 'border-purple-700 bg-purple-200 bg-opacity-15'
                            : 'border-purple-500 bg-purple-200 bg-opacity-25'
                        }`;
                    return (
                      <div
                        key={c.id}
                        className={wrapperClass}
                        style={{
                          left: `${c.cropX * 100}%`,
                          top: `${c.cropY * 100}%`,
                          width: `${c.cropWidth * 100}%`,
                          height: `${c.cropHeight * 100}%`,
                          pointerEvents: isFullpage ? 'none' : tool ? 'none' : 'auto',
                        }}
                        onClick={(e) => {
                          if (isFullpage || tool) return;
                          e.stopPropagation();
                          setActiveCropId(isActive ? null : c.id);
                        }}
                      >
                        {c.label && !isFullpage ? (
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
                            color={tool === 'highlight' ? highlightColor : penColor}
                            strokeWidth={strokeWidth}
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

      <aside className="w-72 flex-shrink-0 flex flex-col gap-4">
        {activeCropId ? (
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
              Annotate active crop
            </p>
            <div className="mt-2 flex gap-1">
              <button
                type="button"
                onClick={() => setTool(tool === 'pen' ? null : 'pen')}
                aria-pressed={tool === 'pen'}
                className={`flex-1 min-h-[36px] rounded px-2 py-1 text-xs ${
                  tool === 'pen'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pen
              </button>
              <button
                type="button"
                onClick={() => setTool(tool === 'highlight' ? null : 'highlight')}
                aria-pressed={tool === 'highlight'}
                className={`flex-1 min-h-[36px] rounded px-2 py-1 text-xs ${
                  tool === 'highlight'
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Highlight
              </button>
              <button
                type="button"
                onClick={() => setTool(tool === 'eraser' ? null : 'eraser')}
                aria-pressed={tool === 'eraser'}
                className={`flex-1 min-h-[36px] rounded px-2 py-1 text-xs ${
                  tool === 'eraser'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Erase
              </button>
            </div>

            {(tool === 'pen' || tool === 'highlight') && (
              <>
                <p className="mt-3 text-[10px] uppercase tracking-wide text-gray-500">
                  Color
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(tool === 'highlight' ? HIGHLIGHT_COLORS : PEN_COLORS).map((c) => {
                    const selected = (tool === 'highlight' ? highlightColor : penColor) === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Use color ${c}`}
                        aria-pressed={selected}
                        onClick={() =>
                          tool === 'highlight'
                            ? setHighlightColor(c)
                            : setPenColor(c)
                        }
                        className={`h-7 w-7 rounded-full border-2 ${
                          selected ? 'border-gray-900 dark:border-white' : 'border-transparent'
                        }`}
                        style={{ background: c }}
                      />
                    );
                  })}
                </div>

                <p className="mt-3 text-[10px] uppercase tracking-wide text-gray-500">
                  Stroke width ({Math.round(strokeWidth * 1000)})
                </p>
                <input
                  type="range"
                  min={1}
                  max={30}
                  value={Math.round(strokeWidth * 1000)}
                  onChange={(e) => setStrokeWidth(Number(e.target.value) / 1000)}
                  className="mt-1 w-full"
                  aria-label="Stroke width"
                />
              </>
            )}

            <div className="mt-3 flex gap-1">
              <button
                type="button"
                onClick={() => void annotationLayerRef.current?.undo()}
                disabled={stackCounts.undo === 0}
                className="flex-1 min-h-[36px] rounded border border-gray-300 dark:border-gray-700 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                Undo ({stackCounts.undo})
              </button>
              <button
                type="button"
                onClick={() => void annotationLayerRef.current?.redo()}
                disabled={stackCounts.redo === 0}
                className="flex-1 min-h-[36px] rounded border border-gray-300 dark:border-gray-700 px-2 py-1 text-xs text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40"
              >
                Redo ({stackCounts.redo})
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setActiveCropId(null);
                setTool(null);
              }}
              className="mt-3 w-full text-xs text-gray-500 hover:text-gray-700"
            >
              Done
            </button>
          </div>
        ) : null}

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
              className="mt-2 w-full rounded border border-gray-300 px-2 py-1 text-sm"
              maxLength={120}
            />
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={saveCrop}
                className="flex-1 rounded bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={cancelDraft}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Crops ({crops.length})
          </h3>
          {crops.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">
              Click and drag on a page to mark a region.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {crops.map((c) => {
                const isQK = c.isQuickKey;
                return (
                  <li
                    key={c.id}
                    className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-sm ${
                      activeCropId === c.id
                        ? 'bg-purple-50 dark:bg-purple-900/20'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        jumpToPage(c.pageNumber);
                        setActiveCropId(c.id);
                      }}
                      className="flex-1 text-left truncate"
                    >
                      <span className="text-gray-700 dark:text-gray-300">
                        p{c.pageNumber}
                      </span>{' '}
                      <span className="text-gray-900 dark:text-gray-100">
                        {c.label ?? <em className="text-gray-400">unlabeled</em>}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleQuickKey(c)}
                      className={`text-sm leading-none ${
                        isQK ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-500'
                      }`}
                      aria-label={isQK ? 'Remove from QuickKeys' : 'Save as QuickKey'}
                      title={isQK ? 'Remove from QuickKeys' : 'Save as QuickKey'}
                    >
                      ★
                    </button>
                    <button
                      type="button"
                      onClick={() => setChartAssistCrop(c)}
                      className="text-xs text-blue-600 hover:text-blue-800"
                      aria-label="Open chart assistance"
                      title="Align grid + Magic Marker"
                    >
                      ⬚
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCrop(c)}
                      className="text-xs text-red-600 hover:text-red-800"
                      aria-label="Delete crop"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

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

