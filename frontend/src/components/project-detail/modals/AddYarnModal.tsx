import { useState } from 'react';
import { toast } from 'react-toastify';
import { useMeasurements } from '../../../hooks/useMeasurements';
import ModalShell from './ModalShell';

interface YarnOption {
  id: string;
  brand: string;
  name: string;
  color?: string;
  skeins_remaining: number;
  remaining_length_m?: number | null;
  yards_remaining?: number | null;
}

export interface AddYarnData {
  yarnId: string;
  skeinsUsed?: number;
  yardsUsed?: number;
}

interface AddYarnModalProps {
  availableYarn: YarnOption[];
  onClose: () => void;
  onSubmit: (data: AddYarnData) => Promise<void>;
}

export default function AddYarnModal({ availableYarn, onClose, onSubmit }: AddYarnModalProps) {
  const { fmt } = useMeasurements();
  const [selectedYarnId, setSelectedYarnId] = useState('');
  const [yarnQuantity, setYarnQuantity] = useState({ skeins: '', yards: '' });

  const handleAdd = async () => {
    if (!selectedYarnId) {
      toast.error('Please select yarn');
      return;
    }
    try {
      await onSubmit({
        yarnId: selectedYarnId,
        skeinsUsed: yarnQuantity.skeins ? parseFloat(yarnQuantity.skeins) : undefined,
        yardsUsed: yarnQuantity.yards ? parseFloat(yarnQuantity.yards) : undefined,
      });
      onClose();
    } catch {
      // stay open on error
    }
  };

  return (
    <ModalShell titleId="add-yarn-title" title="Add Yarn to Project">
      <div className="p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Yarn
          </label>
          <select
            value={selectedYarnId}
            onChange={(e) => setSelectedYarnId(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">Choose yarn...</option>
            {availableYarn
              .filter((y) => y.skeins_remaining > 0)
              .map((yarn) => (
                <option key={yarn.id} value={yarn.id}>
                  {yarn.brand} {yarn.name} - {yarn.color}
                  ({yarn.skeins_remaining} skeins, {fmt.yarnLength(yarn.remaining_length_m, yarn.yards_remaining)} available)
                </option>
              ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Skeins to Use
            </label>
            <input
              type="number"
              value={yarnQuantity.skeins}
              onChange={(e) => setYarnQuantity({ ...yarnQuantity, skeins: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="0"
              min="0"
              step="0.1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {fmt.yarnLengthUnit() === 'm' ? 'Meters' : 'Yards'} to Use
            </label>
            <input
              type="number"
              value={yarnQuantity.yards}
              onChange={(e) => setYarnQuantity({ ...yarnQuantity, yards: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="0"
              min="0"
              step="1"
            />
          </div>
        </div>

        <p className="text-sm text-gray-500">
          The specified amount will be deducted from your stash automatically.
        </p>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Add Yarn
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
