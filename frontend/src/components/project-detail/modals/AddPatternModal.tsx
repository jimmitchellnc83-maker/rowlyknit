import { useState } from 'react';
import { toast } from 'react-toastify';
import ModalShell from './ModalShell';
import type {
  PatternPickerKind,
  PatternPickerOption,
} from '../availablePatterns';

interface AddPatternModalProps {
  /**
   * Pre-merged + deduped picker options. Legacy and canonical-only
   * patterns are tagged with `kind` so the submit callback can build the
   * correct request body (`{ patternId }` vs `{ patternModelId }`)
   * without the modal needing to know about the API contract.
   */
  options: PatternPickerOption[];
  /**
   * Legacy pattern ids already attached to the project (from
   * `project.patterns[i].id`). Filters out duplicates from the picker.
   */
  existingLegacyIds: string[];
  /**
   * Canonical pattern_model ids already attached (from
   * `project.patterns[i].canonicalPatternModelId`). When a canonical-only
   * pattern is attached, the backend materializes a legacy stub and the
   * canonical id surfaces here on the next refetch — so re-opening the
   * modal correctly hides the already-attached canonical option.
   */
  existingCanonicalIds: string[];
  onClose: () => void;
  onSubmit: (selection: { kind: PatternPickerKind; id: string }) => Promise<void>;
}

export default function AddPatternModal({
  options,
  existingLegacyIds,
  existingCanonicalIds,
  onClose,
  onSubmit,
}: AddPatternModalProps) {
  const [selectedValue, setSelectedValue] = useState('');

  const visibleOptions = options.filter((opt) =>
    opt.kind === 'legacy'
      ? !existingLegacyIds.includes(opt.id)
      : !existingCanonicalIds.includes(opt.id),
  );

  const parseSelection = (
    value: string,
  ): { kind: PatternPickerKind; id: string } | null => {
    const colon = value.indexOf(':');
    if (colon < 0) return null;
    const kind = value.slice(0, colon) as PatternPickerKind;
    const id = value.slice(colon + 1);
    if ((kind !== 'legacy' && kind !== 'canonical') || !id) return null;
    return { kind, id };
  };

  const handleAdd = async () => {
    const selection = parseSelection(selectedValue);
    if (!selection) {
      toast.error('Please select a pattern');
      return;
    }
    try {
      await onSubmit(selection);
      onClose();
    } catch {
      // stay open on error
    }
  };

  return (
    <ModalShell titleId="add-pattern-title" title="Add Pattern to Project">
      <div className="p-6">
        <label
          htmlFor="add-pattern-select"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Select Pattern
        </label>
        <select
          id="add-pattern-select"
          data-testid="add-pattern-select"
          value={selectedValue}
          onChange={(e) => setSelectedValue(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent mb-4"
        >
          <option value="">Choose a pattern...</option>
          {visibleOptions.map((option) => (
            <option key={`${option.kind}:${option.id}`} value={`${option.kind}:${option.id}`}>
              {option.name}
              {option.designer ? ` by ${option.designer}` : ''}
              {option.kind === 'canonical' ? ' (Designer)' : ''}
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
            data-testid="add-pattern-submit"
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
          >
            Add Pattern
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
