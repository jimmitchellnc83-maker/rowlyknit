import { useMemo } from 'react';
import { FiActivity } from 'react-icons/fi';
import {
  buildHeatmapGrid,
  formatHours,
  type DayActivity,
} from './heatmapLayout';

interface Props {
  activity: DayActivity[];
  days: number;
  loading?: boolean;
}

const CELL = 12;
const GAP = 2;

const LEVEL_CLASSES = [
  'fill-gray-100 dark:fill-gray-700',
  'fill-green-200 dark:fill-green-900',
  'fill-green-400 dark:fill-green-700',
  'fill-green-600 dark:fill-green-500',
  'fill-green-800 dark:fill-green-300',
] as const;

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

export default function ActivityHeatmap({ activity, days, loading = false }: Props) {
  const grid = useMemo(() => buildHeatmapGrid(activity, days), [activity, days]);

  const width = grid.weekCount * (CELL + GAP) + 30;
  const height = 7 * (CELL + GAP) + 20;

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
          <FiActivity className="w-5 h-5" />
          Activity
        </h3>
        <div className="h-28 bg-gray-50 dark:bg-gray-700 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6"
      data-testid="activity-heatmap"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <FiActivity className="w-5 h-5" />
          Activity
        </h3>
        <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4">
          <span>
            <span className="font-medium text-gray-900 dark:text-white">{grid.totals.activeDays}</span> active days
          </span>
          <span>
            <span className="font-medium text-gray-900 dark:text-white">{formatHours(grid.totals.totalSeconds)}</span> total
          </span>
          <span>
            <span className="font-medium text-gray-900 dark:text-white">{grid.totals.longestStreakDays}</span>-day streak
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="text-gray-500 dark:text-gray-400"
          role="img"
          aria-label={`Knitting activity heatmap over the last ${days} days`}
        >
          {grid.monthLabels.map((m) => (
            <text
              key={`${m.week}-${m.label}`}
              x={30 + m.week * (CELL + GAP)}
              y={10}
              fontSize="10"
              fill="currentColor"
            >
              {m.label}
            </text>
          ))}

          {DAY_LABELS.map((label, i) =>
            label ? (
              <text
                key={i}
                x={0}
                y={20 + i * (CELL + GAP) + CELL - 2}
                fontSize="9"
                fill="currentColor"
              >
                {label}
              </text>
            ) : null,
          )}

          {grid.cells.map((c) => (
            <rect
              key={c.date}
              x={30 + c.week * (CELL + GAP)}
              y={20 + c.dayOfWeek * (CELL + GAP)}
              width={CELL}
              height={CELL}
              rx={2}
              className={LEVEL_CLASSES[c.level]}
            >
              <title>
                {c.date} — {formatHours(c.seconds)}
                {c.sessionCount ? ` (${c.sessionCount} session${c.sessionCount === 1 ? '' : 's'})` : ''}
              </title>
            </rect>
          ))}
        </svg>
      </div>

      <div className="flex items-center justify-end gap-1 mt-2 text-xs text-gray-500 dark:text-gray-400">
        <span className="mr-1">Less</span>
        {LEVEL_CLASSES.map((cls, i) => (
          <svg key={i} width={CELL} height={CELL} aria-hidden="true">
            <rect width={CELL} height={CELL} rx={2} className={cls} />
          </svg>
        ))}
        <span className="ml-1">More</span>
      </div>
    </div>
  );
}
