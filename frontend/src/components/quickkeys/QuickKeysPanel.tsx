import { useEffect, useState } from 'react';
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
}

/**
 * Active-knitting QuickKey consumer. Fetches the pattern's saved
 * QuickKey crops and renders them as a tap-to-view list with a
 * lightweight in-place modal so the knitter can reference a saved
 * snippet without losing row state (no navigation, modal close
 * returns to the same Make Mode view).
 */
export default function QuickKeysPanel({ patternId }: Props) {
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

      <ul className="space-y-1">
        {sorted.map((qk) => (
          <li key={qk.cropId}>
            <button
              type="button"
              onClick={() => setActive(qk)}
              className="w-full text-left px-2 py-2 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 text-sm flex items-center justify-between gap-2 group"
            >
              <span className="flex items-center gap-1.5 truncate">
                <FiZoomIn className="h-3.5 w-3.5 text-gray-400 group-hover:text-purple-600 flex-shrink-0" />
                <span className="truncate">
                  {qk.label || `QuickKey #${(qk.quickKeyPosition ?? 0) + 1}`}
                </span>
              </span>
              <span className="text-xs text-gray-500 flex-shrink-0">
                p.{qk.pageNumber}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {active && (
        <QuickKeyViewerModal
          quickKey={active}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

interface ViewerProps {
  quickKey: QuickKeyEntry;
  onClose: () => void;
}

/**
 * In-place crop viewer. Renders the source PDF page at a fixed width
 * and overlays the saved crop rectangle as a highlighted region. Closes
 * back to the QuickKey list without unmounting any Make Mode state —
 * row counters, marker state, and section progress all survive because
 * this modal is a sibling, not a route.
 */
function QuickKeyViewerModal({ quickKey, onClose }: ViewerProps) {
  const [renderedSize, setRenderedSize] = useState<{ w: number; h: number } | null>(
    null,
  );

  // Render the PDF page at a width that fits typical knitting tablets
  // (max 720px, capped to viewport). The crop rect lives in normalized
  // coords, so we multiply by the rendered size to get pixel offsets.
  const targetWidth = Math.min(
    720,
    typeof window !== 'undefined' ? window.innerWidth - 80 : 720,
  );

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
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              {quickKey.label || `QuickKey #${(quickKey.quickKeyPosition ?? 0) + 1}`}
            </h4>
            <p className="text-xs text-gray-500">Page {quickKey.pageNumber}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close QuickKey"
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 relative">
          <Document
            file={sourceFileBytesUrl(quickKey.sourceFileId)}
            loading={<div className="text-sm text-gray-500 p-8 text-center">Loading…</div>}
            error={
              <div className="text-sm text-red-600 p-8 text-center">
                Could not load source file.
              </div>
            }
          >
            <div className="relative inline-block">
              <Page
                pageNumber={quickKey.pageNumber}
                width={targetWidth}
                renderAnnotationLayer={false}
                renderTextLayer={false}
                onRenderSuccess={(page) => {
                  setRenderedSize({ w: page.width, h: page.height });
                }}
              />
              {renderedSize && (
                <div
                  className="absolute border-4 border-amber-400 bg-amber-200/20 pointer-events-none rounded-sm"
                  style={{
                    left: `${quickKey.cropX * renderedSize.w}px`,
                    top: `${quickKey.cropY * renderedSize.h}px`,
                    width: `${quickKey.cropWidth * renderedSize.w}px`,
                    height: `${quickKey.cropHeight * renderedSize.h}px`,
                  }}
                />
              )}
            </div>
          </Document>
        </div>
      </div>
    </div>
  );
}
