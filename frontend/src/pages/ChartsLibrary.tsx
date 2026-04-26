import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiArchive, FiCopy, FiEdit2, FiPenTool, FiSearch, FiTrash2, FiRotateCcw, FiInbox } from 'react-icons/fi';
import {
  useArchiveChart,
  useChartList,
  useDeleteChart,
  useDuplicateChart,
  useRestoreChart,
  useUpdateChart,
  type SavedChart,
} from '../hooks/useCharts';
import ChartGrid from '../components/designer/ChartGrid';
import ConfirmModal from '../components/ConfirmModal';
import { useSeo } from '../hooks/useSeo';
import { useNoIndex } from '../hooks/useNoIndex';

/**
 * Personal chart library — shows every chart the user has saved, with
 * search, archive toggle, duplicate, rename, and delete actions.
 *
 * Backed by the CRUD endpoints added in Session 4 PR 1.1
 * (`/api/charts`). Cards render a compact non-interactive ChartGrid as
 * the thumbnail so a knitter scanning the grid can recognise their
 * own designs at a glance.
 */
export default function ChartsLibrary() {
  useSeo({
    title: 'Charts | Rowly',
    description: 'Your saved chart library — reuse motifs across projects.',
    canonicalPath: '/charts',
  });
  useNoIndex();

  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const list = useChartList({
    archived: showArchived,
    q: search.trim() || undefined,
  });

  const charts = list.data?.charts ?? [];

  return (
    <div className="space-y-4 p-4 md:space-y-6 md:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 md:text-4xl">
            Charts
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
            Save a stitch chart once and reuse it across designs. Charts you save from the{' '}
            <Link to="/designer" className="text-purple-600 hover:underline dark:text-purple-300">
              Designer
            </Link>{' '}
            land here.
          </p>
        </div>
        <Link
          to="/designer"
          className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          <FiPenTool className="h-4 w-4" />
          Open Designer
        </Link>
      </header>

      <section className="flex flex-wrap items-center gap-3 rounded-lg bg-white p-3 shadow dark:bg-gray-800">
        <label className="relative flex-1 min-w-[200px]">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            aria-label="Search charts"
          />
        </label>
        <div className="inline-flex rounded-md border border-gray-300 dark:border-gray-600">
          {[
            { value: false, label: 'Active' },
            { value: true, label: 'Archived' },
          ].map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              onClick={() => setShowArchived(opt.value)}
              aria-pressed={showArchived === opt.value}
              className={`px-3 py-1.5 text-xs font-medium ${
                showArchived === opt.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      {list.isLoading && (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500 dark:bg-gray-800/40">
          Loading charts…
        </p>
      )}
      {list.isError && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Couldn't load charts. Check your connection and refresh.
        </p>
      )}

      {!list.isLoading && !list.isError && charts.length === 0 && (
        <EmptyState archived={showArchived} hasSearch={!!search.trim()} />
      )}

      {charts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {charts.map((c) => (
            <ChartCard key={c.id} chart={c} archived={showArchived} />
          ))}
        </div>
      )}

      {list.data && list.data.total > charts.length && (
        <p className="text-xs text-gray-500">
          Showing {charts.length} of {list.data.total}. Refine your search to narrow down.
        </p>
      )}
    </div>
  );
}

function EmptyState({ archived, hasSearch }: { archived: boolean; hasSearch: boolean }) {
  if (hasSearch) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center dark:border-gray-600 dark:bg-gray-800/40">
        <FiInbox className="mx-auto h-10 w-10 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          No charts match your search.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center dark:border-gray-600 dark:bg-gray-800/40">
      <FiInbox className="mx-auto h-10 w-10 text-gray-400" />
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {archived
          ? 'No archived charts. Archived charts show up here when you archive them from the Active list.'
          : 'No saved charts yet. Open the Designer, draw a chart, and click "Save chart as asset" to start a library.'}
      </p>
    </div>
  );
}

function ChartCard({ chart, archived }: { chart: SavedChart; archived: boolean }) {
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [name, setName] = useState(chart.name);

  const updateChart = useUpdateChart();
  const archiveChart = useArchiveChart();
  const restoreChart = useRestoreChart();
  const duplicateChart = useDuplicateChart();
  const deleteChart = useDeleteChart();

  // The grid stored on the server may be missing in legacy rows or come
  // back as a sparse object. Guard so the thumbnail can still render
  // (or fall back to an empty placeholder).
  const safeGrid = useMemo(() => {
    const g = chart.grid as any;
    if (g && Array.isArray(g.cells) && g.width && g.height) return g;
    return null;
  }, [chart.grid]);

  const updatedAt = new Date(chart.updated_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const submitRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === chart.name) {
      setRenaming(false);
      setName(chart.name);
      return;
    }
    try {
      await updateChart.mutateAsync({ id: chart.id, input: { name: trimmed } });
      setRenaming(false);
      toast.success('Chart renamed');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to rename');
    }
  };

  const onArchive = async () => {
    try {
      await archiveChart.mutateAsync(chart.id);
      toast.success('Chart archived');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to archive');
    }
  };
  const onRestore = async () => {
    try {
      await restoreChart.mutateAsync(chart.id);
      toast.success('Chart restored');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to restore');
    }
  };
  const onDuplicate = async () => {
    try {
      const copy = await duplicateChart.mutateAsync(chart.id);
      toast.success(`Duplicated as "${copy.name}"`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to duplicate');
    }
  };
  const onDelete = async () => {
    try {
      await deleteChart.mutateAsync(chart.id);
      setConfirmDelete(false);
      toast.success('Chart deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <article className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-2">
        {renaming ? (
          <form onSubmit={submitRename} className="flex flex-1 gap-2">
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              className="flex-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
            <button
              type="submit"
              disabled={updateChart.isPending}
              className="rounded-md bg-purple-600 px-2 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setRenaming(false);
                setName(chart.name);
              }}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200"
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <h2
                className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100"
                title={chart.name}
              >
                {chart.name}
              </h2>
              <p className="text-xs text-gray-500">
                {chart.columns}×{chart.rows} · updated {updatedAt}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRenaming(true)}
              className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
              title="Rename"
              aria-label="Rename chart"
            >
              <FiEdit2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <div className="flex justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/40">
        {safeGrid ? (
          <ChartGrid
            chart={safeGrid}
            onChange={() => {}}
            tool={{ type: 'erase' }}
            cellSize={Math.max(6, Math.min(14, Math.floor(280 / Math.max(safeGrid.width, 1))))}
            readOnly
          />
        ) : (
          <p className="py-8 text-xs italic text-gray-500">No grid data.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onDuplicate}
          disabled={duplicateChart.isPending}
          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <FiCopy className="h-3.5 w-3.5" /> Duplicate
        </button>
        {archived ? (
          <button
            type="button"
            onClick={onRestore}
            disabled={restoreChart.isPending}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <FiRotateCcw className="h-3.5 w-3.5" /> Restore
          </button>
        ) : (
          <button
            type="button"
            onClick={onArchive}
            disabled={archiveChart.isPending}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <FiArchive className="h-3.5 w-3.5" /> Archive
          </button>
        )}
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="ml-auto inline-flex items-center gap-1 rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/30"
          title="Delete permanently"
        >
          <FiTrash2 className="h-3.5 w-3.5" /> Delete
        </button>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title="Delete chart"
          message={`Permanently delete "${chart.name}"? This cannot be undone — prefer Archive if you might want it back.`}
          confirmLabel="Delete"
          onConfirm={onDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </article>
  );
}
