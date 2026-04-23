import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FiX, FiRotateCcw } from 'react-icons/fi';

interface HistoryEntry {
  id: string;
  counter_id: string;
  old_value: number;
  new_value: number;
  action: string;
  user_note: string | null;
  created_at: string;
}

interface Props {
  projectId: string;
  counterId: string;
  currentRow: number;
  onClose: () => void;
  onReverted: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  increment: 'Advanced',
  decrement: 'Retreated',
  reset: 'Reset',
  updated: 'Edited',
  jump: 'Jumped',
  undo: 'Undone',
  linked_update: 'Linked update',
  created: 'Created',
};

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleString();
}

export default function HistoryScrubber({
  projectId,
  counterId,
  currentRow,
  onClose,
  onReverted,
}: Props) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [reverting, setReverting] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(
        `/api/projects/${projectId}/counters/${counterId}/history?limit=100`,
      );
      setEntries(res.data.data.history);
    } catch {
      toast.error('Could not load history');
    } finally {
      setLoading(false);
    }
  }, [projectId, counterId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const revertTo = async (entry: HistoryEntry) => {
    if (
      !window.confirm(
        `Revert master counter back to row ${entry.old_value}? This will snap every panel to its derived row at that point.`,
      )
    ) {
      return;
    }
    setReverting(entry.id);
    try {
      await axios.post(
        `/api/projects/${projectId}/counters/${counterId}/undo/${entry.id}`,
      );
      toast.success(`Reverted to row ${entry.old_value}`);
      onReverted();
      onClose();
    } catch (err) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.message : null;
      toast.error(msg || 'Could not revert');
    } finally {
      setReverting(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-0 sm:px-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-t-lg sm:rounded-lg w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              History · currently row {currentRow}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Tap an entry to revert — every panel snaps back to its derived row.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Loading…
            </p>
          ) : entries.length === 0 ? (
            <p className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
              No history yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-800">
              {entries.map((entry) => {
                const delta = entry.new_value - entry.old_value;
                const label = ACTION_LABELS[entry.action] || entry.action;
                const isCurrent = entry.new_value === currentRow;
                return (
                  <li
                    key={entry.id}
                    className={`px-4 py-3 flex items-center justify-between gap-2 ${
                      isCurrent ? 'bg-blue-50 dark:bg-blue-950/30' : ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        <span className="font-medium">{label}</span>
                        {' · row '}
                        <span className="tabular-nums">{entry.old_value}</span>
                        {' → '}
                        <span className="tabular-nums font-semibold">
                          {entry.new_value}
                        </span>
                        {delta !== 0 && (
                          <span
                            className={`ml-2 text-xs tabular-nums ${
                              delta > 0
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-orange-600 dark:text-orange-400'
                            }`}
                          >
                            {delta > 0 ? '+' : ''}
                            {delta}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatTimestamp(entry.created_at)}
                        {entry.user_note && ` · ${entry.user_note}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => revertTo(entry)}
                      disabled={reverting !== null || isCurrent}
                      className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                      aria-label={`Revert to row ${entry.old_value}`}
                    >
                      <FiRotateCcw className="w-3 h-3" />
                      {isCurrent ? 'Here' : 'Revert'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
