import { useEffect, useRef, useState } from 'react';
import { toast } from 'react-toastify';
import { FiX, FiCheck, FiArchive } from 'react-icons/fi';
import {
  useChart,
  useChartList,
  useCreateChart,
  useUpdateChart,
  type SavedChart,
} from '../../hooks/useCharts';
import ChartGrid, { type ChartData } from './ChartGrid';

/**
 * Modal that saves the current Designer chart as a library asset, OR
 * updates an already-saved asset in place. Behavior depends on whether
 * `chartId` is provided:
 *   - chartId present  → PUT /api/charts/:id (rename optional)
 *   - chartId null     → POST /api/charts with the user-entered name
 *
 * On success, the parent receives the new/updated chartId via
 * `onSaved` so it can mark the form clean and enable export.
 */
export function SaveChartModal({
  chart,
  chartId,
  defaultName,
  onClose,
  onSaved,
}: {
  chart: ChartData;
  chartId: string | null;
  defaultName: string;
  onClose: () => void;
  onSaved: (saved: SavedChart) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState('');
  const existing = useChart(chartId);
  const create = useCreateChart();
  const update = useUpdateChart();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (existing.data?.description != null) {
      setDescription(existing.data.description);
    }
  }, [existing.data?.description]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const saved = chartId
        ? await update.mutateAsync({
            id: chartId,
            input: { name: trimmed, grid: chart, description: description || null },
          })
        : await create.mutateAsync({
            name: trimmed,
            grid: chart,
            description: description || null,
            source: 'manual',
          });
      toast.success(chartId ? 'Chart updated' : 'Chart saved to library');
      onSaved(saved);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save chart');
    }
  };

  const busy = create.isPending || update.isPending;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div ref={dialogRef} className="w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <form onSubmit={submit}>
          <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {chartId ? 'Update saved chart' : 'Save chart to library'}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
          <div className="space-y-3 p-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Name
              </span>
              <input
                autoFocus
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={255}
                required
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Description <span className="text-xs font-normal text-gray-500">(optional)</span>
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </label>
            <p className="text-xs text-gray-500">
              {chart.width}×{chart.height} grid · saves to your{' '}
              <a href="/charts" className="text-purple-600 hover:underline">
                Charts library
              </a>
              .
            </p>
          </div>
          <div className="flex justify-end gap-2 border-t border-gray-200 p-3 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !name.trim()}
              className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-60"
            >
              <FiCheck className="h-4 w-4" />
              {busy ? 'Saving…' : chartId ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Picker modal listing the user's library charts — clicking one calls
 * `onSelect(chart)` and dismisses. Searchable; archived charts hidden.
 */
export function LoadChartModal({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (chart: SavedChart) => void;
}) {
  const [search, setSearch] = useState('');
  const list = useChartList({ q: search.trim() || undefined });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const charts = list.data?.charts ?? [];

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Load saved chart
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>
        <div className="border-b border-gray-200 p-3 dark:border-gray-700">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            aria-label="Search saved charts"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {list.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
          {list.isError && (
            <p className="text-sm text-red-600">Couldn't load charts.</p>
          )}
          {!list.isLoading && !list.isError && charts.length === 0 && (
            <p className="rounded-md border border-dashed border-gray-300 p-4 text-center text-sm text-gray-500">
              {search.trim()
                ? 'No charts match your search.'
                : 'No saved charts yet — save your first chart from the Designer.'}
            </p>
          )}
          {charts.length > 0 && (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {charts.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c)}
                    className="group flex w-full flex-col gap-2 rounded-md border border-gray-200 p-2 text-left transition hover:border-purple-400 hover:bg-purple-50 dark:border-gray-600 dark:hover:bg-purple-900/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                        {c.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {c.columns}×{c.rows}
                      </span>
                    </div>
                    {c.grid && (c.grid as any).cells && (
                      <div className="overflow-hidden rounded border border-gray-200 dark:border-gray-700">
                        <ChartGrid
                          chart={c.grid as ChartData}
                          onChange={() => {}}
                          tool={{ type: 'erase' }}
                          cellSize={Math.max(6, Math.min(12, Math.floor(220 / Math.max(c.columns, 1))))}
                          readOnly
                        />
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-700">
          <span className="inline-flex items-center gap-1">
            <FiArchive className="h-3.5 w-3.5" />
            Archived charts are hidden — restore from the library to see them.
          </span>
        </div>
      </div>
    </div>
  );
}
