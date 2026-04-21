import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiX, FiAlertCircle } from 'react-icons/fi';
import HelpTooltip from '../../HelpTooltip';
import ConfirmModal from '../../ConfirmModal';
import { useMeasurements } from '../../../hooks/useMeasurements';
import { metersToYards } from '../../../utils/yarnUnits';

interface Props {
  yarn: any[];
  onRemove: (yarnId: string) => Promise<void>;
  onAddClick: () => void;
}

const getYarnPercentage = (y: any) => {
  const remaining = y.yarn_remaining || 0;
  const total = y.yarn_total || 1;
  return Math.max(0, Math.min(100, (remaining / total) * 100));
};

export default function ProjectYarnUsage({ yarn, onRemove, onAddClick }: Props) {
  const { fmt } = useMeasurements();
  const [removeYarnTarget, setRemoveYarnTarget] = useState<string | null>(null);

  const handleConfirmRemove = async () => {
    if (!removeYarnTarget) return;
    try {
      await onRemove(removeYarnTarget);
    } finally {
      setRemoveYarnTarget(null);
    }
  };

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

        {yarn.length > 0 ? (
          <div className="space-y-4">
            {yarn.map((y: any) => {
              const percentage = getYarnPercentage(y);
              const yardsFallback = y.remaining_length_m != null ? metersToYards(y.remaining_length_m) : (y.yards_remaining || 0);
              const isLowStock = y.low_stock_alert && yardsFallback <= (y.low_stock_threshold || 0);

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
                        {y.skeins_used || 0} skeins, {fmt.yarnLength(null, y.yards_used || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Remaining in Stash</p>
                      <p className="text-xs font-medium text-gray-900">
                        {y.skeins_remaining || 0} skeins, {fmt.yarnLength(y.remaining_length_m, y.yards_remaining)}
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
                      Low stock! Only {fmt.yarnLength(y.remaining_length_m, y.yards_remaining)} remaining
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
