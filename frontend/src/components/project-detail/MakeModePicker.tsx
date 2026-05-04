import { Link } from 'react-router-dom';
import { FiPlay, FiX } from 'react-icons/fi';

export interface MakeModePickerPattern {
  id: string;
  name: string | null;
  designer?: string | null;
  canonicalPatternModelId: string | null;
}

interface MakeModePickerProps {
  patterns: MakeModePickerPattern[];
  onClose: () => void;
}

/**
 * Small picker modal shown when a project has multiple attached patterns
 * and the user clicks "Open in Make Mode" on Project Detail. Lists each
 * pattern with a direct link to its canonical Make Mode page; legacy-only
 * patterns (no canonical twin) render as a disabled row with an
 * explanation so the user understands why they can't be opened from this
 * surface.
 *
 * Kept intentionally simple — no search, no sort, no thumbnails. Multi-
 * pattern projects in the wild are typically 2-3 patterns (sweater + a
 * sleeve chart, hat + a colorwork chart, …). If that ever changes, swap
 * this for a richer picker.
 */
export default function MakeModePicker({ patterns, onClose }: MakeModePickerProps) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="make-mode-picker-title"
    >
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-start justify-between gap-4">
          <div>
            <h2
              id="make-mode-picker-title"
              className="text-xl font-bold text-gray-900"
            >
              Open in Make Mode
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Pick which pattern to follow row-by-row.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close pattern picker"
            className="text-gray-400 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <ul className="p-2" data-testid="make-mode-picker-list">
          {patterns.map((p) => {
            const canonical = p.canonicalPatternModelId;
            if (canonical) {
              return (
                <li key={p.id}>
                  <Link
                    to={`/patterns/${canonical}/make`}
                    onClick={onClose}
                    data-testid="make-mode-picker-canonical-row"
                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-purple-50 min-h-[48px]"
                  >
                    <FiPlay className="h-5 w-5 text-blue-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {p.name ?? 'Untitled pattern'}
                      </p>
                      {p.designer && (
                        <p className="text-sm text-gray-500 truncate">
                          by {p.designer}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            }
            return (
              <li
                key={p.id}
                data-testid="make-mode-picker-legacy-row"
                className="flex items-center gap-3 px-4 py-3 rounded-lg min-h-[48px] opacity-60"
                aria-disabled="true"
                title="This pattern doesn't have a canonical Make Mode yet — open it from the project workspace instead."
              >
                <FiPlay className="h-5 w-5 text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-700 truncate">
                    {p.name ?? 'Untitled pattern'}
                  </p>
                  <p className="text-xs text-gray-500">
                    Legacy pattern — opens in project workspace
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
