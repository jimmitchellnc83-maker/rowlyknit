import { useState } from 'react';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';
import {
  MEASUREMENT_FIELDS,
  type RecipientMeasurements,
} from '../../types/measurements';
import { useMeasurementPrefs } from '../../hooks/useMeasurementPrefs';
import { inToCm, cmToIn } from '../../measurement/convert';

interface Props {
  value: RecipientMeasurements;
  onChange: (next: RecipientMeasurements) => void;
}

const GROUP_LABELS: Record<string, string> = {
  body: 'Body',
  foot: 'Foot (socks)',
  hand: 'Hand (mittens & gloves)',
  head: 'Head (hats)',
};

const GROUP_ORDER: Array<'body' | 'foot' | 'hand' | 'head'> = [
  'body',
  'foot',
  'hand',
  'head',
];

/**
 * Renders the CYC measurements form section. Storage is always in
 * inches; the input fields display in whatever unit the user has
 * configured (`lengthDisplayUnit` from `useMeasurementPrefs`) and
 * convert back to inches before bubbling the change up.
 */
export default function MeasurementsFields({ value, onChange }: Props) {
  const { prefs } = useMeasurementPrefs();
  const useCm = prefs.lengthDisplayUnit === 'cm';
  const unitLabel = useCm ? 'cm' : 'in';
  const [expanded, setExpanded] = useState(() => {
    // Open the body section by default since most users come here for
    // sweater fits; collapse foot/hand/head until expanded.
    return new Set<string>(['body']);
  });

  const toggle = (group: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  const handleFieldChange = (
    key: keyof RecipientMeasurements,
    raw: string
  ): void => {
    if (raw.trim() === '') {
      const next = { ...value };
      delete next[key];
      onChange(next);
      return;
    }
    const parsed = parseFloat(raw);
    if (!Number.isFinite(parsed)) return;
    // The user typed in the displayed unit; convert to inches for storage.
    const inches = useCm ? cmToIn(parsed) : parsed;
    onChange({ ...value, [key]: inches });
  };

  const display = (inches: number | undefined): string => {
    if (typeof inches !== 'number') return '';
    const num = useCm ? inToCm(inches) : inches;
    // 1 decimal place in cm reads more naturally; inches keep 2 in case
    // someone typed 7.25.
    const rounded = useCm ? Math.round(num * 10) / 10 : Math.round(num * 100) / 100;
    return rounded.toString();
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-700/40 px-4 py-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Measurements
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            CYC body sizing fields. Inputs in {unitLabel}; storage normalized
            to inches.
          </p>
        </div>
      </div>
      <div>
        {GROUP_ORDER.map((group) => {
          const fields = MEASUREMENT_FIELDS.filter((f) => f.group === group);
          if (fields.length === 0) return null;
          const isOpen = expanded.has(group);
          const filledCount = fields.filter(
            (f) => typeof value[f.key] === 'number'
          ).length;
          return (
            <div key={group} className="border-t border-gray-200 dark:border-gray-700 first:border-t-0">
              <button
                type="button"
                onClick={() => toggle(group)}
                className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-gray-50 dark:hover:bg-gray-700/40 transition"
                aria-expanded={isOpen}
              >
                <div className="flex items-center gap-2">
                  {isOpen ? <FiChevronDown className="h-4 w-4" /> : <FiChevronRight className="h-4 w-4" />}
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {GROUP_LABELS[group]}
                  </span>
                  {filledCount > 0 && (
                    <span className="text-xs rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200 px-2 py-0.5">
                      {filledCount} {filledCount === 1 ? 'value' : 'values'}
                    </span>
                  )}
                </div>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  {fields.map((field) => (
                    <label key={field.key} className="block">
                      <span className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                        {field.label}{' '}
                        <span className="text-gray-400 dark:text-gray-500 font-normal">
                          ({unitLabel})
                        </span>
                      </span>
                      {field.description && (
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {field.description}
                        </span>
                      )}
                      <input
                        type="number"
                        inputMode="decimal"
                        step={useCm ? '0.5' : '0.25'}
                        min="0"
                        value={display(value[field.key])}
                        onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        className="mt-1 w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                        placeholder="—"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
