import { useEffect, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import { FiBookmark, FiX, FiZoomIn } from 'react-icons/fi';
import {
  listQuickKeysForPattern,
  sourceFileBytesUrl,
  type QuickKeyEntry,
} from '../../lib/sourceFiles';
import '../../lib/pdfjsWorker';

interface Props {
  patternId: string;
  /** Optional active row to highlight inside the QuickKey viewer.
   *  When the QuickKey crop has a chart alignment, the viewer paints a
   *  horizontal line at the active row so the knitter sees their place
   *  on the chart from Make Mode. */
  activeRow?: number;
}

/**
 * Active-knitting QuickKey consumer. Fetches the pattern's saved
 * QuickKey crops and renders them as a tap-to-view list with a
 * lightweight in-place modal so the knitter can reference a saved
 * snippet without losing row state (no navigation, modal close
 * returns to the same Make Mode view).
 */
export default function QuickKeysPanel({ patternId, activeRow }: Props) {
  const [qks, setQks] = useState<QuickKeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<QuickKeyEntry | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listQuickKeysForPattern(patternId)
      .then((rows) => {
        if (!cancelled) {
          setQks(rows);
          setError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load QuickKeys.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [patternId]);

  if (loading) return null;

  const sorted = [...qks].sort(
    (a, b) => (a.quickKeyPosition ?? 999) - (b.quickKeyPosition ?? 999),
  );

  if (sorted.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5 mb-2">
          <FiBookmark className="h-4 w-4 text-purple-500" />
          QuickKeys
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No QuickKeys yet. Open the pattern's Sources tab, draw a crop on a PDF, then tap the ★ on the crop to pin it as a QuickKey. It appears here next time you knit.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
          <FiBookmark className="h-4 w-4 text-purple-500" />
          QuickKeys ({sorted.length})
        </h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Saved snippets from your pattern. Tap to view without losing your row.
      </p>

      {error && (
        <p className="text-xs text-red-600 mb-2">{error}</p>
      )}

      <ul className="space-y-1.5">
        {sorted.map((qk) => (
          <li key={qk.cropId}>
            <button
              type="button"
              onClick={() => setActive(qk)}
              className="w-full text-left p-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm flex items-center gap-2 group"
            >
              <CropThumbnail quickKey={qk} />
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-1.5 truncate">
                  <FiZoomIn className="h-3.5 w-3.5 text-gray-400 group-hover:text-purple-600 flex-shrink-0" />
                  <span className="truncate font-medium">
                    {qk.label || `QuickKey #${(qk.quickKeyPosition ?? 0) + 1}`}
                  </span>
                </span>
                <span className="text-xs text-gray-500 block">
                  Page {qk.pageNumber}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {active && (
        <QuickKeyViewerModal
          quickKey={active}
          activeRow={activeRow}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

/**
 * 64×64 thumbnail of the saved crop. Renders the underlying PDF page
 * scaled so the crop region fills the thumbnail. Uses the same
 * translate-into-overflow-hidden trick as the viewer modal.
 */
function CropThumbnail({ quickKey }: { quickKey: QuickKeyEntry }) {
  const [pageRendered, setPageRendered] = useState<{ w: number; h: number } | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const THUMB_W = 64;
  const safeCropWidth = quickKey.cropWidth > 0 ? quickKey.cropWidth : 1;
  const safeCropHeight = quickKey.cropHeight > 0 ? quickKey.cropHeight : 1;
  const pageWidth = Math.round(THUMB_W / safeCropWidth);
  const offsetX = -quickKey.cropX * pageWidth;
  const thumbHeight = pageRendered
    ? Math.round(pageRendered.h * safeCropHeight)
    : THUMB_W;
  const offsetY = pageRendered ? -quickKey.cropY * pageRendered.h : 0;

  return (
    <div
      ref={containerRef}
      className="flex-shrink-0 rounded overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900"
      style={{ width: `${THUMB_W}px`, height: `${thumbHeight}px` }}
    >
      <Document
        file={sourceFileBytesUrl(quickKey.sourceFileId)}
        loading={null}
        error={null}
      >
        <div
          style={{
            transform: `translate(${offsetX}px, ${offsetY}px)`,
            transformOrigin: 'top left',
            width: `${pageWidth}px`,
          }}
        >
          <Page
            pageNumber={quickKey.pageNumber}
            width={pageWidth}
            renderAnnotationLayer={false}
            renderTextLayer={false}
            onRenderSuccess={(page) => {
              setPageRendered({ w: page.width, h: page.height });
            }}
          />
        </div>
      </Document>
    </div>
  );
}

interface ViewerProps {
  quickKey: QuickKeyEntry;
  /** Active row from Make Mode. Painted as a horizontal indicator
   *  inside the chart-aligned region when present. */
  activeRow?: number;
  onClose: () => void;
}

/**
 * In-place crop viewer. Renders the source PDF page scaled so the
 * saved crop rectangle exactly fills the viewer — the user sees only
 * the snippet they pinned, not the whole page with a tiny highlight
 * in one corner. A "Show full page" toggle lets them back out for
 * context if needed.
 *
 * Closes back to the QuickKey list without unmounting any Make Mode
 * state — row counters, marker state, and section progress all
 * survive because this modal is a sibling, not a route.
 */
function QuickKeyViewerModal({ quickKey, activeRow, onClose }: ViewerProps) {
  const [showFullPage, setShowFullPage] = useState(false);
  const [alignment, setAlignment] = useState<{
    cellsDown: number;
    gridY: number;
    gridHeight: number;
  } | null>(null);

  // Pull alignment for this crop so we can paint an active-row line.
  // 404 is fine — many crops aren't grid-aligned.
  useEffect(() => {
    if (activeRow === undefined) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/source-files/${quickKey.sourceFileId}/crops/${quickKey.cropId}/alignment`,
          { credentials: 'include' },
        );
        if (!res.ok) return;
        const body = await res.json();
        const a = body?.data?.alignment;
        if (!cancelled && a && typeof a.cellsDown === 'number') {
          setAlignment({
            cellsDown: a.cellsDown,
            gridY: a.gridY,
            gridHeight: a.gridHeight,
          });
        }
      } catch {
        // ignore — alignment is optional
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quickKey.sourceFileId, quickKey.cropId, activeRow]);

  // Aim for a viewer ~640 wide for the cropped snippet so chart text
  // stays legible on a tablet. We achieve that by computing the
  // backing PDF page width such that `pageWidth * cropWidth ≈ target`.
  const viewportTarget = Math.min(
    720,
    typeof window !== 'undefined' ? window.innerWidth - 80 : 720,
  );

  // Guard against a zero-width crop (shouldn't happen — backend
  // validates `gt: 0` — but keep the math safe).
  const safeCropWidth = quickKey.cropWidth > 0 ? quickKey.cropWidth : 1;
  const safeCropHeight = quickKey.cropHeight > 0 ? quickKey.cropHeight : 1;

  // When showing only the crop, render the underlying page at a width
  // that makes the cropped region equal `viewportTarget` pixels wide.
  // The wrapper's overflow:hidden + transform translation produces the
  // crop window. When showing full page, fall back to viewportTarget.
  const pageWidth = showFullPage
    ? viewportTarget
    : Math.round(viewportTarget / safeCropWidth);

  const offsetX = showFullPage ? 0 : -quickKey.cropX * pageWidth;

  // Page height is unknown until render; the wrapper height tracks
  // pageHeight*cropHeight via the rendered size callback.
  const [pageRendered, setPageRendered] = useState<{ w: number; h: number } | null>(
    null,
  );
  const wrapperHeight = pageRendered
    ? showFullPage
      ? pageRendered.h
      : pageRendered.h * safeCropHeight
    : undefined;
  const offsetY = showFullPage || !pageRendered ? 0 : -quickKey.cropY * pageRendered.h;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-4xl max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              {quickKey.label || `QuickKey #${(quickKey.quickKeyPosition ?? 0) + 1}`}
            </h4>
            <p className="text-xs text-gray-500">Page {quickKey.pageNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFullPage((v) => !v)}
              className="text-xs rounded border border-gray-300 dark:border-gray-700 px-2 py-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {showFullPage ? 'Show only crop' : 'Show full page'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close QuickKey"
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4">
          <Document
            file={sourceFileBytesUrl(quickKey.sourceFileId)}
            loading={<div className="text-sm text-gray-500 p-8 text-center">Loading…</div>}
            error={
              <div className="text-sm text-red-600 p-8 text-center">
                Could not load source file.
              </div>
            }
          >
            <div
              className="relative mx-auto overflow-hidden"
              style={{
                width: `${viewportTarget}px`,
                height: wrapperHeight ? `${wrapperHeight}px` : undefined,
                background: '#f3f4f6',
              }}
            >
              <div
                style={{
                  transform: `translate(${offsetX}px, ${offsetY}px)`,
                  transformOrigin: 'top left',
                  width: `${pageWidth}px`,
                }}
              >
                <Page
                  pageNumber={quickKey.pageNumber}
                  width={pageWidth}
                  renderAnnotationLayer={false}
                  renderTextLayer={false}
                  onRenderSuccess={(page) => {
                    setPageRendered({ w: page.width, h: page.height });
                  }}
                />
              </div>
              {/* Active row indicator — painted on top of the cropped
                  region when this crop has a chart alignment + the host
                  passed an activeRow. Charts in patterns are usually
                  read bottom-up; we map the row into the grid's Y span
                  and paint a horizontal band. */}
              {!showFullPage && alignment && activeRow !== undefined && wrapperHeight && (
                <ActiveRowBand
                  alignment={alignment}
                  activeRow={activeRow}
                  cropHeight={safeCropHeight}
                  cropWrapperHeight={wrapperHeight}
                />
              )}
            </div>
          </Document>
        </div>
      </div>
    </div>
  );
}

/**
 * Horizontal band that lights the active row inside a chart-aligned
 * crop. Math: the grid spans cropHeight × gridHeight of the page; row
 * 1 sits at the *bottom* (charts are read bottom-up) so we measure
 * from the grid's bottom edge.
 */
function ActiveRowBand(props: {
  alignment: { cellsDown: number; gridY: number; gridHeight: number };
  activeRow: number;
  cropHeight: number;
  cropWrapperHeight: number;
}) {
  const { alignment, activeRow, cropHeight, cropWrapperHeight } = props;
  if (alignment.cellsDown <= 0) return null;
  // Clamp row to [1, cellsDown] so out-of-range values don't paint
  // outside the grid.
  const row = Math.max(1, Math.min(alignment.cellsDown, activeRow));
  const cellHFraction = alignment.gridHeight / alignment.cellsDown;
  // Grid lives at y=gridY..(gridY+gridHeight) inside the crop.
  // Row 1 = bottom band: cropY position = gridY + gridHeight - row*cellH.
  const yInCrop = alignment.gridY + alignment.gridHeight - row * cellHFraction;
  // crop coords are 0..1 of the underlying page; we're rendering crop at
  // cropHeight fraction of the page, then scaled up to wrapper height.
  const topPx = (yInCrop / cropHeight) * cropWrapperHeight;
  const heightPx = (cellHFraction / cropHeight) * cropWrapperHeight;
  return (
    <div
      aria-label={`Active row ${activeRow}`}
      className="absolute left-0 right-0 pointer-events-none"
      style={{
        top: `${topPx}px`,
        height: `${heightPx}px`,
        background: 'rgba(34, 197, 94, 0.25)',
        borderTop: '2px solid rgba(34, 197, 94, 0.85)',
        borderBottom: '2px solid rgba(34, 197, 94, 0.85)',
      }}
    />
  );
}
