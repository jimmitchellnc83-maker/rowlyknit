import { useCallback, useEffect, useState } from 'react';
import { FiClock, FiCornerUpLeft, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import {
  listMarkerHistory,
  rewindMarkerHistory,
  type MarkerStateHistoryEntry,
} from '../../lib/markerState';

interface Props {
  projectId: string;
}

const SURFACE_LABEL: Record<string, string> = {
  counter: 'Counter',
  panel: 'Panel',
  chart: 'Chart',
};

/**
 * Wave 4 marker history surface. Lists the project's most recent
 * marker position changes (counter / panel / chart) and lets the user
 * rewind to a previous position with one tap. Closes the user-audit
 * gap "Marker history / rewind backend exists, no visible UI."
 *
 * Pulls the most recent 25 events; rewinding triggers a re-fetch.
 * Renders an empty state when there's nothing to show so the panel
 * is self-explanatory rather than silent.
 */
export default function MarkerHistoryPanel({ projectId }: Props) {
  const [history, setHistory] = useState<MarkerStateHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [rewinding, setRewinding] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    try {
      const rows = await listMarkerHistory(projectId, 25);
      setHistory(rows);
    } catch {
      toast.error('Could not load marker history.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const rows = await listMarkerHistory(projectId, 25);
        if (!cancelled) setHistory(rows);
      } catch {
        if (!cancelled) toast.error('Could not load marker history.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function handleRewind(entryId: string) {
    if (!window.confirm('Rewind to this earlier position?')) return;
    setRewinding(entryId);
    try {
      await rewindMarkerHistory(projectId, entryId);
      toast.success('Position rewound.');
      await fetchHistory();
    } catch {
      toast.error('Rewind failed.');
    } finally {
      setRewinding(null);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
          <FiClock className="h-4 w-4 text-amber-500" />
          Marker history
        </h3>
        <button
          type="button"
          onClick={fetchHistory}
          aria-label="Refresh"
          className="p-1 rounded text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <FiRefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : history.length === 0 ? (
        <p className="text-xs text-gray-500 italic">
          No tracked marker changes yet. As you advance counters or chart rows,
          each step appears here so you can rewind with one tap.
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-60 overflow-y-auto">
          {history.map((h) => (
            <li
              key={h.id}
              className="rounded border border-gray-200 dark:border-gray-700 p-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-800 dark:text-gray-200">
                  {SURFACE_LABEL[h.surface] ?? h.surface}
                  {h.surfaceRef ? (
                    <span className="ml-1 text-gray-500">· {h.surfaceRef}</span>
                  ) : null}
                </span>
                <button
                  type="button"
                  disabled={!h.previousPosition || rewinding === h.id}
                  onClick={() => handleRewind(h.id)}
                  className="text-blue-600 hover:text-blue-800 disabled:opacity-40 flex items-center gap-1"
                  title={
                    h.previousPosition
                      ? 'Rewind to the position before this change'
                      : 'No prior position to rewind to'
                  }
                >
                  <FiCornerUpLeft className="h-3.5 w-3.5" />
                  Rewind
                </button>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-2 text-[11px] text-gray-500">
                <span>
                  {h.previousPosition
                    ? <>was {summarizePosition(h.previousPosition)}</>
                    : <em>initial</em>}
                </span>
                <span className="text-right text-gray-700 dark:text-gray-300">
                  → {summarizePosition(h.newPosition)}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] text-gray-400">
                {new Date(h.createdAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function summarizePosition(p: Record<string, unknown>): string {
  // Position is a free-form bag. Surface row e.g. {row: 12} or
  // {row: 12, col: 3}. Render the most knitting-relevant fields first
  // and gracefully fall back to JSON for unknown shapes.
  const known = ['row', 'col', 'panel', 'page', 'index'];
  const parts: string[] = [];
  for (const k of known) {
    if (p[k] !== undefined && p[k] !== null) {
      parts.push(`${k} ${String(p[k])}`);
    }
  }
  if (parts.length > 0) return parts.join(', ');
  try {
    return JSON.stringify(p).slice(0, 50);
  } catch {
    return '—';
  }
}
