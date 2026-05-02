import { useEffect, useState } from 'react';
import { FiFile, FiLayers, FiPlus, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import {
  ASPECT_PRESETS,
  createBlankPage,
  createJoinLayout,
  deleteBlankPage,
  deleteJoinLayout,
  listBlankPages,
  listJoinLayouts,
  type BlankPage,
  type BlankPageAspect,
  type JoinLayout,
} from '../../lib/wave6';
import BlankPageDrawingModal from './BlankPageDrawingModal';
import JoinLayoutEditor from './JoinLayoutEditor';

interface Props {
  projectId: string;
  /** Pattern IDs attached to this project. Passed through to the join
   *  layout editor so it can fetch + display the available crops. */
  patternIds?: string[];
}

/**
 * Wave 6 entry point on ProjectDetail. Lists join layouts + blank pages
 * with create/delete affordances. Blank pages open a drawing modal that
 * persists strokes via PATCH; join layouts are created with a name and
 * an empty regions array (drag-drop region editor is a follow-up PR).
 *
 * The PRD requires both surfaces be reachable from normal product flow.
 * This section renders inside the project's normal layout, which means
 * Wave 6 stops being backend-only.
 */
export default function LayoutsAndPagesSection({ projectId, patternIds = [] }: Props) {
  const [layouts, setLayouts] = useState<JoinLayout[]>([]);
  const [pages, setPages] = useState<BlankPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [openPage, setOpenPage] = useState<BlankPage | null>(null);
  const [openLayout, setOpenLayout] = useState<JoinLayout | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([listJoinLayouts(projectId), listBlankPages(projectId)])
      .then(([l, p]) => {
        if (cancelled) return;
        setLayouts(l);
        setPages(p);
      })
      .catch(() => {
        if (!cancelled) toast.error('Failed to load layouts/pages.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleCreateLayout() {
    const name = window.prompt('Name this layout (e.g. "Front + Sleeves side-by-side"):');
    if (!name) return;
    try {
      const created = await createJoinLayout(projectId, { name: name.trim() });
      setLayouts((prev) => [created, ...prev]);
      toast.success('Layout created. Add regions in the next iteration.');
    } catch {
      toast.error('Failed to create layout.');
    }
  }

  async function handleDeleteLayout(layout: JoinLayout) {
    if (!window.confirm(`Delete "${layout.name}"?`)) return;
    try {
      await deleteJoinLayout(projectId, layout.id);
      setLayouts((prev) => prev.filter((l) => l.id !== layout.id));
    } catch {
      toast.error('Failed to delete.');
    }
  }

  async function handleCreatePage() {
    const aspect = (window.prompt(
      'Aspect (letter, a4, square, custom):',
      'letter',
    ) ?? '').toLowerCase().trim() as BlankPageAspect;
    const presets = ASPECT_PRESETS[aspect] ?? ASPECT_PRESETS.letter;
    const finalAspect: BlankPageAspect = (
      ['letter', 'a4', 'square', 'custom'] as BlankPageAspect[]
    ).includes(aspect)
      ? aspect
      : 'letter';
    const name = window.prompt('Page name (optional):') ?? null;
    try {
      const created = await createBlankPage(projectId, {
        name: name?.trim() || null,
        aspectKind: finalAspect,
        width: presets.width,
        height: presets.height,
      });
      setPages((prev) => [created, ...prev]);
      setOpenPage(created);
    } catch {
      toast.error('Failed to create page.');
    }
  }

  async function handleDeletePage(page: BlankPage) {
    if (!window.confirm(`Delete "${page.name ?? 'untitled page'}"?`)) return;
    try {
      await deleteBlankPage(projectId, page.id);
      setPages((prev) => prev.filter((p) => p.id !== page.id));
    } catch {
      toast.error('Failed to delete.');
    }
  }

  return (
    <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
      {/* Join layouts */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FiLayers className="h-5 w-5 text-blue-500" />
            Join layouts
          </h2>
          <button
            type="button"
            onClick={handleCreateLayout}
            className="text-sm rounded bg-blue-600 text-white px-3 py-1.5 hover:bg-blue-700 flex items-center gap-1"
          >
            <FiPlus className="h-4 w-4" /> New layout
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Combine multiple chart crops onto one canvas — pin a sleeve chart next to the body chart so you can read both at once.
        </p>
        {loading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : layouts.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No layouts yet.</p>
        ) : (
          <ul className="space-y-1">
            {layouts.map((l) => (
              <li
                key={l.id}
                className="flex items-center justify-between rounded px-3 py-2 bg-gray-50 dark:bg-gray-900/40"
              >
                <button
                  type="button"
                  onClick={() => setOpenLayout(l)}
                  className="text-sm text-left text-gray-800 dark:text-gray-200 hover:text-blue-600 flex-1"
                >
                  {l.name}
                  <span className="ml-2 text-xs text-gray-500">
                    {l.regions.length} region{l.regions.length === 1 ? '' : 's'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpenLayout(l)}
                  className="text-blue-600 hover:text-blue-800 text-xs mr-2"
                  aria-label={`Edit ${l.name}`}
                >
                  <FiEdit2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteLayout(l)}
                  className="text-red-600 hover:text-red-800 text-xs"
                  aria-label={`Delete ${l.name}`}
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Blank pages */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <FiFile className="h-5 w-5 text-purple-500" />
            Blank pages
          </h2>
          <button
            type="button"
            onClick={handleCreatePage}
            className="text-sm rounded bg-purple-600 text-white px-3 py-1.5 hover:bg-purple-700 flex items-center gap-1"
          >
            <FiPlus className="h-4 w-4" /> New blank page
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          A clean drawing surface for sketches, notes, schematics — anything you'd grab a piece of graph paper for.
        </p>
        {loading ? (
          <p className="text-xs text-gray-400">Loading…</p>
        ) : pages.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No blank pages yet.</p>
        ) : (
          <ul className="space-y-1">
            {pages.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded px-3 py-2 bg-gray-50 dark:bg-gray-900/40"
              >
                <button
                  type="button"
                  onClick={() => setOpenPage(p)}
                  className="text-sm text-left text-gray-800 dark:text-gray-200 hover:text-purple-600 flex-1"
                >
                  {p.name ?? <em className="text-gray-400">untitled</em>}
                  <span className="ml-2 text-xs text-gray-500">
                    {p.aspectKind} · {Array.isArray(p.strokes) ? p.strokes.length : 0} strokes
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeletePage(p)}
                  className="text-red-600 hover:text-red-800 text-xs"
                  aria-label={`Delete ${p.name ?? 'page'}`}
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {openPage && (
        <BlankPageDrawingModal
          projectId={projectId}
          page={openPage}
          onClose={() => setOpenPage(null)}
          onSaved={(saved) => {
            setPages((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
            setOpenPage(saved);
          }}
        />
      )}

      {openLayout && (
        <JoinLayoutEditor
          projectId={projectId}
          layout={openLayout}
          patternIds={patternIds}
          onClose={() => setOpenLayout(null)}
          onSaved={(saved) => {
            setLayouts((prev) => prev.map((l) => (l.id === saved.id ? saved : l)));
            setOpenLayout(saved);
          }}
        />
      )}
    </section>
  );
}
