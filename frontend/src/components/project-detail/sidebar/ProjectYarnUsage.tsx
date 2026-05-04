import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiX, FiAlertCircle, FiDollarSign } from 'react-icons/fi';
import HelpTooltip from '../../HelpTooltip';
import ConfirmModal from '../../ConfirmModal';
import { useMeasurementPrefs } from '../../../hooks/useMeasurementPrefs';
import { metersToYards } from '../../../utils/yarnUnits';

interface Props {
  yarn: any[];
  onRemove: (yarnId: string) => Promise<void>;
  onAddClick: () => void;
}

// "Stash level" bar: how much of the original stash is still on hand for
// this yarn, expressed as a percentage. Pre-fix this read `yarn_remaining`
// and `yarn_total`, fields the API never returns, so every bar always
// rendered as 0%. The wire shape (see backend/src/controllers/projectsController.ts
// where it joins `yarns y` with `project_yarn` columns `yards_used` /
// `skeins_used`) gives us per-row `skeins_remaining` (current stash) and
// `skeins_used` (allocated to this project). Original stash is
// remaining + used; if both are missing we fall back to the length
// fields so a yarn with only meters tracked still gets a meaningful bar.
const getYarnPercentage = (y: any): number => {
  const skeinsRemaining = Number(y.skeins_remaining ?? 0);
  const skeinsUsedHere = Number(y.skeins_used ?? 0);
  const skeinsOriginal = skeinsRemaining + skeinsUsedHere;
  if (skeinsOriginal > 0) {
    return Math.max(0, Math.min(100, (skeinsRemaining / skeinsOriginal) * 100));
  }
  // Length-based fallback (meters preferred, yards if that's what was
  // entered). Same shape: original = remaining + used.
  const remainingMeters =
    y.remaining_length_m != null
      ? Number(y.remaining_length_m)
      : y.yards_remaining != null
        ? Number(y.yards_remaining) * 0.9144
        : 0;
  const usedMeters =
    y.yards_used != null ? Number(y.yards_used) * 0.9144 : 0;
  const originalMeters = remainingMeters + usedMeters;
  if (originalMeters > 0) {
    return Math.max(0, Math.min(100, (remainingMeters / originalMeters) * 100));
  }
  return 0;
};

const toNumber = (v: unknown): number => {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const parsed = parseFloat(String(v));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (v: number): string =>
  v.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

/** Cost of one yarn in this project. Null when price_per_skein is unset. */
const yarnCost = (y: any): number | null => {
  const price = y.price_per_skein;
  if (price == null) return null;
  const parsed = toNumber(price);
  if (parsed <= 0) return null;
  return parsed * toNumber(y.skeins_used);
};

export default function ProjectYarnUsage({ yarn, onRemove, onAddClick }: Props) {
  const { fmt } = useMeasurementPrefs();
  const [removeYarnTarget, setRemoveYarnTarget] = useState<string | null>(null);

  const handleConfirmRemove = async () => {
    if (!removeYarnTarget) return;
    try {
      await onRemove(removeYarnTarget);
    } finally {
      setRemoveYarnTarget(null);
    }
  };

  const costEntries = yarn.map(yarnCost);
  const pricedCount = costEntries.filter((c): c is number => c != null).length;
  const unpricedCount = yarn.length - pricedCount;
  const totalCost = costEntries.reduce<number>((sum, c) => sum + (c ?? 0), 0);

  return (
    <>
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Yarn Usage <HelpTooltip text="Track which yarn from your stash you're using in this project and how much." />
          </h2>
          <button
            onClick={onAddClick}
            className="text-purple-600 hover:text-purple-700"
            title="Add yarn"
          >
            <FiPlus className="h-5 w-5" />
          </button>
        </div>

        {yarn.length > 0 && pricedCount > 0 ? (
          <div
            className="mb-4 flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-3"
            aria-label="Project yarn cost"
          >
            <FiDollarSign className="mt-0.5 h-4 w-4 flex-shrink-0 text-purple-600" />
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wide text-purple-700">Project yarn cost</p>
              <p className="text-xl font-bold text-purple-900">{formatCurrency(totalCost)}</p>
              {unpricedCount > 0 ? (
                <p className="mt-0.5 text-xs text-amber-700">
                  {unpricedCount} yarn{unpricedCount === 1 ? '' : 's'} without a price — total is a lower bound
                </p>
              ) : null}
            </div>
          </div>
        ) : null}

        {yarn.length > 0 ? (
          <div className="space-y-4">
            {yarn.map((y: any) => {
              const percentage = getYarnPercentage(y);
              const yardsFallback = y.remaining_length_m != null ? metersToYards(y.remaining_length_m) : (y.yards_remaining || 0);
              const isLowStock = y.low_stock_alert && yardsFallback <= (y.low_stock_threshold || 0);
              const entryCost = yarnCost(y);

              return (
                <div key={y.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <Link
                        to={`/yarn/${y.id}`}
                        className="text-sm font-medium text-purple-600 hover:text-purple-700 hover:underline"
                      >
                        {y.brand} {y.name}
                        {y.color && <span className="text-gray-600"> - {y.color}</span>}
                      </Link>
                      <p className="text-xs text-gray-500">{y.weight}</p>
                    </div>
                    <button
                      onClick={() => setRemoveYarnTarget(y.id)}
                      className="text-red-600 hover:text-red-700 p-1"
                      title="Remove yarn"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-2 mb-3">
                    <div>
                      <p className="text-xs text-gray-500">Used in Project</p>
                      <p className="text-xs font-medium text-gray-900">
                        {y.skeins_used || 0} skeins, {fmt.yarnLength((y.yards_used || 0) * 0.9144)}
                        {entryCost != null ? (
                          <span className="ml-2 text-purple-700">{formatCurrency(entryCost)}</span>
                        ) : null}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Remaining in Stash</p>
                      <p className="text-xs font-medium text-gray-900">
                        {y.skeins_remaining || 0} skeins, {fmt.yarnLength(y.remaining_length_m ?? (y.yards_remaining != null ? y.yards_remaining * 0.9144 : null))}
                      </p>
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                      <span>Stash Level</span>
                      <span>{percentage.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          percentage < 20 ? 'bg-red-500' : percentage < 50 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>

                  {isLowStock && (
                    <div className="flex items-center text-orange-600 text-xs mt-2">
                      <FiAlertCircle className="mr-1 h-3 w-3" />
                      Low stock! Only {fmt.yarnLength(y.remaining_length_m ?? (y.yards_remaining != null ? y.yards_remaining * 0.9144 : null))} remaining
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No yarn added</p>
        )}
      </div>

      {removeYarnTarget && (
        <ConfirmModal
          title="Remove yarn from project?"
          message="The used amount will be restored to your stash."
          confirmLabel="Remove"
          variant="warning"
          onConfirm={handleConfirmRemove}
          onCancel={() => setRemoveYarnTarget(null)}
        />
      )}
    </>
  );
}
