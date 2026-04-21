import { useState } from 'react';
import { toast } from 'react-toastify';
import ModalShell from './ModalShell';

interface PatternOption {
  id: string;
  name: string;
  designer?: string;
}

interface AddPatternModalProps {
  availablePatterns: PatternOption[];
  existingPatternIds: string[];
  onClose: () => void;
  onSubmit: (patternId: string) => Promise<void>;
}

export default function AddPatternModal({
  availablePatterns,
  existingPatternIds,
  onClose,
  onSubmit,
}: AddPatternModalProps) {
  const [selectedPatternId, setSelectedPatternId] = useState('');

  const handleAdd = async () => {
    if (!selectedPatternId) {
      toast.error('Please select a pattern');
      return;
    }
    try {
      await onSubmit(selectedPatternId);
      onClose();
    } catch {
      // stay open on error
    }
  };

  return (
    <ModalShell titleId="add-pattern-title" title="Add Pattern to Project">
      <div className="p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Pattern
        </label>
        <select
          value={selectedPatternId}
          onChange={(e) => setSelectedPatternId(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
        >
          <option value="">Choose a pattern...</option>
          {availablePatterns
            .filter((p) => !existingPatternIds.includes(p.id))
            .map((pattern) => (
              <option key={pattern.id} value={pattern.id}>
                {pattern.name}
                {pattern.designer && ` by ${pattern.designer}`}
              </option>
            ))}
        </select>

        <div className="flex gap-3">
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
            Add Pattern
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
