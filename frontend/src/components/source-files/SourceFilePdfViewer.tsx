import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { toast } from 'react-toastify';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import {
  createCrop,
  deleteCrop,
  listCropsForSourceFile,
  type PatternCrop,
  type SourceFile,
  sourceFileBytesUrl,
} from '../../lib/sourceFiles';
import { trackEvent } from '../../lib/analytics';
import { dragToRect, isMeaningfulRect, pointInPage } from './cropMath';

pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

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
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());

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

  function jumpToPage(page: number) {
    const ref = pageRefs.current.get(page);
    if (ref) ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
                if (el) pageRefs.current.set(pageNumber, el);
              }}
              data-testid={`pdf-page-${pageNumber}`}
              className="relative inline-block mb-4 select-none"
              onPointerDown={(e) => handlePagePointerDown(pageNumber, e)}
              onPointerMove={(e) => handlePagePointerMove(pageNumber, e)}
              onPointerUp={(e) => handlePagePointerUp(pageNumber, e)}
              style={{ touchAction: 'none' }}
            >
              <Page pageNumber={pageNumber} width={600} />
              {/* Saved crops on this page */}
              {crops
                .filter((c) => c.pageNumber === pageNumber)
                .map((c) => (
                  <div
                    key={c.id}
                    className="absolute border-2 border-purple-500 bg-purple-200 bg-opacity-25 pointer-events-none"
                    style={{
                      left: `${c.cropX * 100}%`,
                      top: `${c.cropY * 100}%`,
                      width: `${c.cropWidth * 100}%`,
                      height: `${c.cropHeight * 100}%`,
                    }}
                  >
                    {c.label ? (
                      <span className="absolute -top-5 left-0 text-xs bg-purple-600 text-white px-1.5 py-0.5 rounded">
                        {c.label}
                      </span>
                    ) : null}
                  </div>
                ))}
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
          ))}
        </Document>
      </div>

      <aside className="w-72 flex-shrink-0 flex flex-col gap-4">
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
              {crops.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1 text-sm hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <button
                    type="button"
                    onClick={() => jumpToPage(c.pageNumber)}
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
                    onClick={() => handleDeleteCrop(c)}
                    className="text-xs text-red-600 hover:text-red-800"
                    aria-label="Delete crop"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  );
}

