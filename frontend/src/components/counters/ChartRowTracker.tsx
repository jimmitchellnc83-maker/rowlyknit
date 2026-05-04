import { FiPlus, FiMinus } from 'react-icons/fi';
import ChartGrid, { type ChartData } from '../designer/ChartGrid';

interface ChartRowTrackerProps {
  chart: ChartData;
  /** 1-indexed active row (clamped on display; out-of-range values render
   *  with no highlight so the knitter still sees the chart). */
  currentRow: number;
  /** Called with +1 / -1 when the knitter steps the row via this tracker. */
  onStep: (delta: number) => void;
  counterName: string;
  disabled?: boolean;
}

/**
 * Read-only chart viewer paired with big step buttons. Sits above a
 * chart-linked row counter on Project Detail so the knitter can see which
 * chart row they're on without context-switching to the Designer page.
 */
export default function ChartRowTracker({
  chart,
  currentRow,
  onStep,
  counterName,
  disabled = false,
}: ChartRowTrackerProps) {
  const clamped = Math.max(1, Math.min(chart.height, currentRow));
  const outOfRange = currentRow < 1 || currentRow > chart.height;

  return (
    <div className="rounded-xl border-2 border-amber-400 bg-amber-50/60 p-4 dark:border-amber-500 dark:bg-amber-900/10">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            {counterName} — chart follower
          </h3>
          <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
            {outOfRange
              ? `Row ${currentRow} (outside chart — showing row ${clamped})`
              : `Row ${clamped} of ${chart.height}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onStep(-1)}
            disabled={disabled || currentRow <= 1}
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-gray-700 shadow hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-gray-800 dark:text-gray-200"
            aria-label="Previous chart row"
          >
            <FiMinus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => onStep(1)}
            disabled={disabled || currentRow >= chart.height}
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500 text-white shadow hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Next chart row"
          >
            <FiPlus className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="max-h-72 overflow-auto rounded border border-amber-300/60 bg-white p-2 dark:bg-gray-900">
        <ChartGrid
          chart={chart}
          onChange={() => {
            /* read-only — guarded by the readOnly flag below */
          }}
          tool={{ type: 'erase' }}
          cellSize={22}
          highlightedRowIndex={clamped}
          readOnly
        />
      </div>
    </div>
  );
}
