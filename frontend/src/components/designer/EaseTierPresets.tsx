import {
  EASE_TIERS,
  EASE_TIER_INCHES,
  EASE_TIER_LABELS,
  tierForEaseInches,
  type EaseTier,
} from '../../utils/easeTiers';

const CM_PER_IN = 2.54;

interface EaseTierPresetsProps {
  // Current ease value, in the active form unit (in or cm).
  value: number | '';
  unit: 'in' | 'cm';
  onSelect: (easeInUnit: number) => void;
}

// Renders five CYC ease-tier buttons (very close → oversized) above the
// Designer's numeric ease input. Selecting a tier writes its preset value
// into the parent in the active unit. The currently active tier is
// highlighted only when the numeric ease lands exactly on a preset.
export default function EaseTierPresets({ value, unit, onSelect }: EaseTierPresetsProps) {
  const easeIn = typeof value === 'number' && Number.isFinite(value)
    ? unit === 'cm' ? value / CM_PER_IN : value
    : null;
  const activeTier: EaseTier | null = easeIn != null ? tierForEaseInches(easeIn, 0.05) : null;

  const handleSelect = (tier: EaseTier) => {
    const easeInActive = unit === 'cm'
      ? Math.round(EASE_TIER_INCHES[tier] * CM_PER_IN * 10) / 10
      : EASE_TIER_INCHES[tier];
    onSelect(easeInActive);
  };

  return (
    <div className="mb-3">
      <div className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
        Ease at chest — fit preset
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EASE_TIERS.map((tier) => {
          const isActive = activeTier === tier;
          const easeInUnit = unit === 'cm'
            ? Math.round(EASE_TIER_INCHES[tier] * CM_PER_IN)
            : EASE_TIER_INCHES[tier];
          const sign = easeInUnit > 0 ? '+' : '';
          return (
            <button
              key={tier}
              type="button"
              onClick={() => handleSelect(tier)}
              aria-pressed={isActive}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                isActive
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {EASE_TIER_LABELS[tier]} <span className="opacity-70">({sign}{easeInUnit} {unit})</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
