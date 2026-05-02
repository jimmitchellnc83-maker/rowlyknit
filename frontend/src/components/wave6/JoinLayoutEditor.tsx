import { useEffect, useMemo, useState } from 'react';
import { FiArrowDown, FiArrowUp, FiPlus, FiSave, FiTrash2, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import {
  listCropsForPattern,
  type PatternCrop,
} from '../../lib/sourceFiles';
import {
  updateJoinLayout,
  type JoinLayout,
  type JoinRegion,
} from '../../lib/wave6';

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

/**
 * Wave 6 PR2 — region editor for a join layout. Lets the user compose
 * a layout from the project's pattern crops:
 *   - Left panel lists every crop on the project's patterns
 *   - "Add" appends a region with default placement (top-left, half size)
 *   - Right panel shows current regions; numeric inputs for x/y/w/h
 *     and arrow buttons to reorder z-index
 *   - Save sends the regions array via PATCH
 *
 * Stops short of a free-drag canvas (deferred — tracker note in
 * release report) but the user can now actually populate a layout
 * which means created layouts are no longer dead artifacts.
 */
export default function JoinLayoutEditor({
  projectId,
  layout,
  patternIds,
  onClose,
  onSaved,
}: Props) {
  const [available, setAvailable] = useState<AvailableCrop[]>([]);
  const [regions, setRegions] = useState<JoinRegion[]>(layout.regions);
  const [name, setName] = useState<string>(layout.name);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  function handleAdd(crop: AvailableCrop) {
    setRegions((prev) => [
      ...prev,
      {
        patternCropId: crop.id,
        x: 0,
        y: 0,
        width: 0.5,
        height: 0.5,
        zIndex: prev.length,
      },
    ]);
  }

  function handleRemove(idx: number) {
    setRegions((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleMove(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= regions.length) return;
    const next = [...regions];
    [next[idx], next[target]] = [next[target], next[idx]];
    // Re-stamp zIndex to match new order.
    const stamped = next.map((r, i) => ({ ...r, zIndex: i }));
    setRegions(stamped);
  }

  function handleField(idx: number, key: keyof JoinRegion, value: string) {
    const v = Number(value);
    if (!Number.isFinite(v)) return;
    setRegions((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: v } : r)),
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await updateJoinLayout(projectId, layout.id, {
        name: name.trim() || layout.name,
        regions,
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
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="font-semibold text-lg bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500 px-1 py-0.5"
            aria-label="Layout name"
          />
          <div className="flex items-center gap-2">
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
              aria-label="Close editor"
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 p-4">
          {/* Available crops */}
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
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
              <ul className="space-y-1 max-h-[60vh] overflow-y-auto">
                {available.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 rounded border border-gray-200 dark:border-gray-700 px-2 py-1.5 text-sm"
                  >
                    <span className="truncate">
                      {c.label ?? <em className="text-gray-400">unlabeled</em>}
                      <span className="ml-2 text-xs text-gray-500">p{c.pageNumber}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAdd(c)}
                      className="rounded bg-purple-600 text-white text-xs px-2 py-1 hover:bg-purple-700 flex items-center gap-1"
                      aria-label={`Add ${c.label ?? 'crop'} to layout`}
                    >
                      <FiPlus className="h-3 w-3" /> Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Regions in this layout */}
          <div>
            <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
              Regions ({regions.length})
            </h5>
            {regions.length === 0 ? (
              <p className="text-xs text-gray-500 italic">
                Click "Add" on a crop to drop it into this layout.
              </p>
            ) : (
              <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
                {regions.map((r, idx) => {
                  const crop = cropsById.get(r.patternCropId);
                  return (
                    <li
                      key={`${r.patternCropId}-${idx}`}
                      className="rounded border border-gray-200 dark:border-gray-700 p-2 text-sm"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="truncate font-medium">
                          {crop?.label ?? <em className="text-gray-400">crop</em>}
                          {crop && (
                            <span className="ml-2 text-xs text-gray-500">p{crop.pageNumber}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMove(idx, -1)}
                            disabled={idx === 0}
                            aria-label="Move up"
                            className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                          >
                            <FiArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMove(idx, 1)}
                            disabled={idx === regions.length - 1}
                            aria-label="Move down"
                            className="p-1 text-gray-500 hover:text-gray-800 disabled:opacity-30"
                          >
                            <FiArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(idx)}
                            aria-label="Remove region"
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <FiTrash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-xs">
                        <NumField label="x" value={r.x} onChange={(v) => handleField(idx, 'x', v)} />
                        <NumField label="y" value={r.y} onChange={(v) => handleField(idx, 'y', v)} />
                        <NumField label="w" value={r.width} onChange={(v) => handleField(idx, 'width', v)} />
                        <NumField label="h" value={r.height} onChange={(v) => handleField(idx, 'height', v)} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-gray-500">
              Coords 0..1 of the layout canvas. Top-left origin.
            </p>
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
    <label className="text-xs">
      <span className="block text-gray-500">{props.label}</span>
      <input
        type="number"
        step={0.01}
        min={0}
        max={1}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="mt-0.5 w-full rounded border border-gray-300 dark:border-gray-700 px-1 py-0.5 text-xs dark:bg-gray-800 dark:text-gray-100"
      />
    </label>
  );
}
