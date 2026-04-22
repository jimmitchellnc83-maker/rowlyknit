import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { FiDollarSign, FiPackage, FiAlertCircle } from 'react-icons/fi';

/**
 * Pulls stash-level cost aggregates from GET /api/yarn/stats and renders a
 * compact summary card. `unpriced_count` is surfaced so users know how many
 * rows are missing a price and thus that the value is a lower bound.
 */
interface StashStats {
  total_count: number | string;
  total_skeins: number | string;
  total_yards: number | string;
  total_value_current: number | string;
  total_value_all_time: number | string;
  priced_count: number | string;
  unpriced_count: number | string;
}

function toNumber(v: number | string | null | undefined): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const parsed = parseFloat(v);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(v: number): string {
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export default function StashValueCard() {
  const { data, isLoading } = useQuery<StashStats>({
    queryKey: ['yarn-stats'],
    queryFn: async () => {
      const res = await axios.get('/api/yarn/stats');
      return res.data.data.stats as StashStats;
    },
    staleTime: 30_000,
  });

  if (isLoading || !data) {
    return (
      <div className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
        <div className="h-14 animate-pulse rounded bg-gray-100 dark:bg-gray-700" />
      </div>
    );
  }

  const currentValue = toNumber(data.total_value_current);
  const allTimeValue = toNumber(data.total_value_all_time);
  const totalSkeins = toNumber(data.total_skeins);
  const priced = toNumber(data.priced_count);
  const unpriced = toNumber(data.unpriced_count);
  const averagePerSkein = totalSkeins > 0 ? currentValue / totalSkeins : 0;

  return (
    <section
      className="mb-6 rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6"
      aria-label="Stash valuation"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <FiDollarSign className="h-3.5 w-3.5" />
            Stash value
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(currentValue)}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">at current remaining skeins</div>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <FiDollarSign className="h-3.5 w-3.5" />
            Spent over time
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {formatCurrency(allTimeValue)}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">total purchase price</div>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <FiPackage className="h-3.5 w-3.5" />
            Avg / skein
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {averagePerSkein > 0 ? formatCurrency(averagePerSkein) : '—'}
          </div>
          <div className="mt-0.5 text-xs text-gray-500">across priced remaining</div>
        </div>
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            <FiPackage className="h-3.5 w-3.5" />
            Priced coverage
          </div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {priced}
            <span className="text-sm font-normal text-gray-500"> / {priced + unpriced}</span>
          </div>
          {unpriced > 0 ? (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
              <FiAlertCircle className="h-3 w-3" />
              {unpriced} yarn{unpriced === 1 ? '' : 's'} without a price — value is a lower bound
            </div>
          ) : (
            <div className="mt-0.5 text-xs text-gray-500">every yarn has a price</div>
          )}
        </div>
      </div>
    </section>
  );
}
