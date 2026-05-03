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

  // Inline create / delete-confirm state. We deliberately avoid
  // `window.prompt`/`window.confirm` here — they synchronously block the
  // renderer, and the create-layout flow froze the tab in the audit run.
  const [layoutDraftName, setLayoutDraftName] = useState<string | null>(null);
  const [pageDraftName, setPageDraftName] = useState<string | null>(null);
  const [pageDraftAspect, setPageDraftAspect] = useState<BlankPageAspect>('letter');
  const [pendingLayoutDelete, setPendingLayoutDelete] = useState<string | null>(null);
  const [pendingPageDelete, setPendingPageDelete] = useState<string | null>(null);

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
    const name = (layoutDraftName ?? '').trim();
    if (!name) return;
    try {
      const created = await createJoinLayout(projectId, { name });
      setLayouts((prev) => [created, ...prev]);
      setLayoutDraftName(null);
      toast.success('Layout created. Add regions in the next iteration.');
    } catch {
      toast.error('Failed to create layout.');
    }
  }

  async function handleDeleteLayout(layoutId: string) {
    try {
      await deleteJoinLayout(projectId, layoutId);
      setLayouts((prev) => prev.filter((l) => l.id !== layoutId));
      setPendingLayoutDelete(null);
    } catch {
      toast.error('Failed to delete.');
    }
  }

  async function handleCreatePage() {
    const presets = ASPECT_PRESETS[pageDraftAspect] ?? ASPECT_PRESETS.letter;
    const name = (pageDraftName ?? '').trim() || null;
    try {
      const created = await createBlankPage(projectId, {
        name,
        aspectKind: pageDraftAspect,
        width: presets.width,
        height: presets.height,
      });
      setPages((prev) => [created, ...prev]);
      setPageDraftName(null);
      setPageDraftAspect('letter');
      setOpenPage(created);
    } catch {
      toast.error('Failed to create page.');
    }
  }

  async function handleDeletePage(pageId: string) {
    try {
      await deleteBlankPage(projectId, pageId);
      setPages((prev) => prev.filter((p) => p.id !== pageId));
      setPendingPageDelete(null);
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
            onClick={() => setLayoutDraftName(layoutDraftName === null ? '' : null)}
            className="text-sm rounded bg-blue-600 text-white px-3 py-1.5 hover:bg-blue-700 flex items-center gap-1"
          >
            <FiPlus className="h-4 w-4" /> New layout
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Combine multiple chart crops onto one canvas — pin a sleeve chart next to the body chart so you can read both at once.
        </p>
        {layoutDraftName !== null && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreateLayout();
            }}
            className="mb-3 flex items-center gap-2 rounded border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900/60 dark:bg-blue-950/40"
          >
            <input
              type="text"
              autoFocus
              placeholder='e.g. "Front + Sleeves side-by-side"'
              value={layoutDraftName}
              onChange={(e) => setLayoutDraftName(e.target.value)}
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <button
              type="submit"
              disabled={!layoutDraftName.trim()}
              className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setLayoutDraftName(null)}
              className="rounded px-2 py-1 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </form>
        )}
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
                {pendingLayoutDelete === l.id ? (
                  <span className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => handleDeleteLayout(l.id)}
                      className="font-medium text-red-600 hover:text-red-800"
                    >
                      Confirm
                    </button>
                    <span className="text-gray-400">·</span>
                    <button
                      type="button"
                      onClick={() => setPendingLayoutDelete(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingLayoutDelete(l.id)}
                    className="text-red-600 hover:text-red-800 text-xs"
                    aria-label={`Delete ${l.name}`}
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                )}
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
            onClick={() => setPageDraftName(pageDraftName === null ? '' : null)}
            className="text-sm rounded bg-purple-600 text-white px-3 py-1.5 hover:bg-purple-700 flex items-center gap-1"
          >
            <FiPlus className="h-4 w-4" /> New blank page
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          A clean drawing surface for sketches, notes, schematics — anything you'd grab a piece of graph paper for.
        </p>
        {pageDraftName !== null && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleCreatePage();
            }}
            className="mb-3 flex flex-wrap items-center gap-2 rounded border border-purple-200 bg-purple-50 px-3 py-2 dark:border-purple-900/60 dark:bg-purple-950/40"
          >
            <input
              type="text"
              autoFocus
              placeholder="Page name (optional)"
              value={pageDraftName}
              onChange={(e) => setPageDraftName(e.target.value)}
              className="flex-1 min-w-[12rem] rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
            <select
              value={pageDraftAspect}
              onChange={(e) => setPageDraftAspect(e.target.value as BlankPageAspect)}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-700 dark:bg-gray-900"
              aria-label="Page aspect"
            >
              <option value="letter">Letter</option>
              <option value="a4">A4</option>
              <option value="square">Square</option>
              <option value="custom">Custom</option>
            </select>
            <button
              type="submit"
              className="rounded bg-purple-600 px-3 py-1 text-sm text-white hover:bg-purple-700"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => {
                setPageDraftName(null);
                setPageDraftAspect('letter');
              }}
              className="rounded px-2 py-1 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancel
            </button>
          </form>
        )}
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
                {pendingPageDelete === p.id ? (
                  <span className="flex items-center gap-1 text-xs">
                    <button
                      type="button"
                      onClick={() => handleDeletePage(p.id)}
                      className="font-medium text-red-600 hover:text-red-800"
                    >
                      Confirm
                    </button>
                    <span className="text-gray-400">·</span>
                    <button
                      type="button"
                      onClick={() => setPendingPageDelete(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPendingPageDelete(p.id)}
                    className="text-red-600 hover:text-red-800 text-xs"
                    aria-label={`Delete ${p.name ?? 'page'}`}
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                )}
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
