// @ts-nocheck
import { useState } from 'react';
import { FiX } from 'react-icons/fi';
import type { Counter, IncrementPattern } from '../../types/counter.types';

interface CounterFormProps {
  projectId: string;
  counter?: Counter | null;
  onSave: (data: Partial<Counter>) => void;
  onCancel: () => void;
}

const COUNTER_COLORS = [
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#10B981', // Green
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#14B8A6', // Teal
];

const INCREMENT_PATTERNS: { value: string; label: string; description: string }[] = [
  { value: 'simple', label: 'Simple (+1 each)', description: 'Standard counting, +1 per row' },
  { value: 'every_n_garter', label: 'Garter Stitch Ridges', description: '+1 every 2 rows (ridge counting)' },
  { value: 'every_n_cable', label: 'Cable Repeats', description: '+1 every 4 rows (cable pattern)' },
  { value: 'custom', label: 'Custom Pattern', description: 'Define your own increment pattern' },
];

export default function CounterForm({ counter, onSave, onCancel }: CounterFormProps) {
  const [name, setName] = useState(counter?.name || '');
  const [type, setType] = useState(counter?.type || 'row');
  const [currentValue, setCurrentValue] = useState(counter?.current_value || 0);
  const [targetValue, setTargetValue] = useState(counter?.target_value || '');
  const [incrementBy] = useState(counter?.increment_by || 1);
  const [minValue, setMinValue] = useState(counter?.min_value || 0);
  const [maxValue, setMaxValue] = useState(counter?.max_value || '');
  const [displayColor, setDisplayColor] = useState(counter?.display_color || COUNTER_COLORS[0]);
  const [notes, setNotes] = useState(counter?.notes || '');
  const [incrementPattern, setIncrementPattern] = useState(counter?.increment_pattern?.type || 'simple');
  const [customIncrement, setCustomIncrement] = useState(counter?.increment_pattern?.increment || 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let pattern: IncrementPattern | undefined;

    switch (incrementPattern) {
      case 'simple':
        pattern = { type: 'simple' };
        break;
      case 'every_n': // garter pattern
        pattern = {
          type: 'every_n',
          rule: 'every_n_rows',
          n: 2,
          increment: 1,
          description: 'Garter stitch ridge counting'
        };
        break;
      case 'every_n_cable':
        pattern = {
          type: 'every_n',
          rule: 'every_n_rows',
          n: 4,
          increment: 1,
          description: 'Cable pattern repeat'
        };
        break;
      case 'custom':
        pattern = {
          type: 'custom_fixed',
          increment: customIncrement,
          description: `Custom: +${customIncrement} per action`
        };
        break;
    }

    const data: Partial<Counter> = {
      name,
      type: type as any,
      current_value: currentValue,
      target_value: targetValue ? Number(targetValue) : undefined,
      increment_by: incrementBy,
      min_value: minValue,
      max_value: maxValue ? Number(maxValue) : undefined,
      display_color: displayColor,
      notes,
      increment_pattern: pattern,
    };

    onSave(data);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">
            {counter ? 'Edit Counter' : 'Create Counter'}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Counter Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              placeholder="e.g., Main Row Counter"
              required
            />
          </div>

          {/* Counter Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Counter Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
            >
              <option value="row">Row Counter</option>
              <option value="stitch">Stitch Counter</option>
              <option value="repeat">Repeat Counter</option>
              <option value="custom">Custom Counter</option>
            </select>
          </div>

          {/* Values */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Value
              </label>
              <input
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Value (optional)
              </label>
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                placeholder="No limit"
              />
            </div>
          </div>

          {/* Min/Max Values */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Value
              </label>
              <input
                type="number"
                value={minValue}
                onChange={(e) => setMinValue(Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Maximum Value (optional)
              </label>
              <input
                type="number"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                placeholder="No limit"
              />
            </div>
          </div>

          {/* Increment Pattern */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Increment Pattern
            </label>
            <div className="space-y-2">
              {INCREMENT_PATTERNS.map((pattern) => (
                <label
                  key={pattern.value}
                  className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="incrementPattern"
                    value={pattern.value}
                    checked={incrementPattern === pattern.value}
                    onChange={(e) => setIncrementPattern(e.target.value as any)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{pattern.label}</div>
                    <div className="text-sm text-gray-500">{pattern.description}</div>
                  </div>
                </label>
              ))}
            </div>

            {incrementPattern === 'custom' && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Increment Value
                </label>
                <input
                  type="number"
                  value={customIncrement}
                  onChange={(e) => setCustomIncrement(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  min="1"
                />
              </div>
            )}
          </div>

          {/* Color Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Counter Color
            </label>
            <div className="flex gap-2 flex-wrap">
              {COUNTER_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setDisplayColor(color)}
                  className={`w-10 h-10 rounded-lg border-2 transition ${
                    displayColor === color ? 'border-gray-900 scale-110' : 'border-gray-200'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
              rows={3}
              placeholder="Add any notes or reminders for this counter..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition"
            >
              {counter ? 'Update Counter' : 'Create Counter'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
