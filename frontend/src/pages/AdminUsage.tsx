import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FiActivity, FiUsers, FiAlertTriangle, FiArrowRight } from 'react-icons/fi';
import { useSeo } from '../hooks/useSeo';

type DayWindow = 7 | 14 | 30 | 90;

interface SummaryRow {
  eventName: string;
  events: number;
  uniqueUsers: number;
}

interface SummaryResponse {
  success: boolean;
  data: { days: number; summary: SummaryRow[] };
}

const WINDOWS: DayWindow[] = [7, 14, 30, 90];

export default function AdminUsage() {
  useSeo({
    title: 'Usage Analytics — Rowly Admin',
    description: 'Founder-only event rollup from the usage_events table.',
  });

  const navigate = useNavigate();
  const [days, setDays] = useState<DayWindow>(14);
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    axios
      .get<SummaryResponse>(`/api/usage-events/summary?days=${days}`)
      .then((res) => {
        if (cancelled) return;
        setRows(res.data.data.summary);
      })
      .catch((err) => {
        if (cancelled) return;
        if (axios.isAxiosError(err) && err.response?.status === 403) {
          // Not the owner — redirect rather than dwell on the empty page.
          navigate('/dashboard', { replace: true });
          return;
        }
        setError(
          axios.isAxiosError(err) && err.response?.data?.message
            ? err.response.data.message
            : 'Failed to load usage summary',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days, navigate]);

  const sorted = [...rows].sort((a, b) => b.uniqueUsers - a.uniqueUsers || b.events - a.events);
  const totalEvents = sorted.reduce((sum, r) => sum + r.events, 0);
  const distinctEvents = sorted.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Usage analytics</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-400">
            Server-side event rollup from the <code className="rounded bg-gray-100 px-1 text-xs dark:bg-gray-800">usage_events</code> table.
            Sorted by unique users so a single enthusiast firing 500 events doesn&apos;t fake out a keep/cut decision.
          </p>
        </div>
        {/* Sister-dashboard link. The business command center reads this
            same usage_events surface plus billing/users/launch — it's
            the founder's daily pane. We point at it from here so /admin/usage
            stops being the hidden default landing for "where's the data". */}
        <Link
          to="/admin/business"
          data-testid="admin-business-link"
          className="inline-flex min-h-[44px] items-center gap-1 self-start rounded border border-purple-300 bg-purple-50 px-3 text-sm font-medium text-purple-800 hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-200 dark:hover:bg-purple-900/50"
        >
          Business dashboard <FiArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600 dark:text-gray-400">Window:</span>
        {WINDOWS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setDays(w)}
            className={`rounded-full px-3 py-1 ${
              days === w
                ? 'bg-purple-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
            }`}
          >
            Last {w}d
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm italic text-gray-500">Loading…</p>
      ) : error ? (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <FiAlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      ) : sorted.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm italic text-gray-500">
          No events recorded in the last {days} days yet.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                <FiActivity className="h-4 w-4" /> Total events
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {totalEvents.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg bg-white p-4 shadow dark:bg-gray-800">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                <FiUsers className="h-4 w-4" /> Distinct event names
              </div>
              <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
                {distinctEvents}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg bg-white shadow dark:bg-gray-800">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/40">
                <tr>
                  <th scope="col" className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    Event
                  </th>
                  <th scope="col" className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    Unique users
                  </th>
                  <th scope="col" className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
                    Events
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {sorted.map((r) => (
                  <tr key={r.eventName}>
                    <td className="px-4 py-2 font-mono text-sm text-gray-900 dark:text-gray-100">
                      {r.eventName}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-gray-100">
                      {r.uniqueUsers.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-700 dark:text-gray-300">
                      {r.events.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500">
            Plausible (page-view + frontend events) lives separately at{' '}
            <a
              href="https://plausible.io/rowlyknit.com"
              target="_blank"
              rel="noreferrer"
              className="text-purple-600 hover:underline"
            >
              plausible.io/rowlyknit.com
            </a>
            .
          </p>
        </>
      )}
    </div>
  );
}
