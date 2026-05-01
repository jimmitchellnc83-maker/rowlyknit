import { useMemo } from 'react';
import { FiCheck } from 'react-icons/fi';
import {
  CARE_SYMBOL_PRESETS,
  careGlyph,
  type CareSymbol,
} from '../../utils/careSymbols';

interface CareSymbolPickerProps {
  /** Currently-selected care symbols (CareSymbol shape, not raw label
   *  strings). Caller bubbles updates through `onChange`. */
  value: CareSymbol[];
  onChange: (next: CareSymbol[]) => void;
}

const GROUP_LABELS: Record<CareSymbol['category'], string> = {
  wash: 'Wash',
  bleach: 'Bleach',
  dry: 'Dry',
  iron: 'Iron',
  dryClean: 'Dry-clean',
};

const GROUP_ORDER: CareSymbol['category'][] = ['wash', 'bleach', 'dry', 'iron', 'dryClean'];

const presetKey = (s: CareSymbol): string =>
  `${s.category}|${s.prohibited ? '1' : '0'}|${s.modifier ?? ''}`;

/**
 * Multi-select chip picker over CYC's canonical care-symbol presets.
 *
 * Within each category, only ONE preset can be active at a time (you
 * can't ask for both "machine wash 30°" and "do not wash"). Selecting
 * a chip in a category replaces any prior pick in the same category.
 */
export default function CareSymbolPicker({ value, onChange }: CareSymbolPickerProps) {
  const selectedKeys = useMemo(
    () => new Set(value.map(presetKey)),
    [value],
  );

  const togglePreset = (preset: CareSymbol): void => {
    const key = presetKey(preset);
    if (selectedKeys.has(key)) {
      onChange(value.filter((v) => presetKey(v) !== key));
      return;
    }
    // Replace any prior pick in the same category before adding.
    const without = value.filter((v) => v.category !== preset.category);
    onChange([...without, preset]);
  };

  return (
    <div className="space-y-3">
      {GROUP_ORDER.map((group) => {
        const presets = CARE_SYMBOL_PRESETS.filter((p) => p.category === group);
        return (
          <div key={group}>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
              {GROUP_LABELS[group]}
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((preset) => {
                const key = presetKey(preset);
                const active = selectedKeys.has(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => togglePreset(preset)}
                    className={
                      active
                        ? 'inline-flex items-center gap-1 rounded-full bg-purple-600 px-3 py-1 text-xs font-medium text-white'
                        : 'inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-gray-700 hover:border-purple-400 hover:text-purple-700 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300'
                    }
                    aria-pressed={active}
                  >
                    {active ? <FiCheck className="h-3 w-3" /> : <span aria-hidden>{careGlyph(preset)}</span>}
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
