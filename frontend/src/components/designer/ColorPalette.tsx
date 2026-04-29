import { useMemo, useState } from 'react';
import { FiPlus, FiTrash2, FiPackage, FiX } from 'react-icons/fi';
import { useYarn } from '../../hooks/useApi';

export interface ColorSwatch {
  id: string;
  label: string;
  hex: string;
  /** Optional reference to a yarn in the user's stash. When set, the
   *  swatch is tied to a specific yarn — useful for "which yarn is this
   *  color in my pattern?" and for downstream stash-vs-needed yardage
   *  comparisons. */
  yarnId?: string | null;
}

interface ColorPaletteProps {
  colors: ColorSwatch[];
  onChange: (next: ColorSwatch[]) => void;
  /** Optional. Fires when an existing swatch's hex changes (color picker
   *  edit). The parent typically uses this to re-map painted chart cells
   *  from oldHex to newHex so the chart stays in sync with the palette. */
  onHexChanged?: (oldHex: string, newHex: string) => void;
}

interface StashYarn {
  id: string;
  name: string;
  brand: string | null;
  color: string | null;
  color_code: string | null;
  weight: string | null;
  skeins_remaining: number | null;
}

const DEFAULT_NEW_COLORS = [
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#EF4444', // red
  '#6B7280', // gray
  '#F3E8FF', // light purple
];

/**
 * Tiny palette editor. Knitters collect 1–N named colors for a design,
 * optionally with a free-text label ("MC" / "CC1" / "Cranberry"). The
 * first color in the list is treated as the main color and used to tint
 * schematic previews.
 */
export default function ColorPalette({ colors, onChange, onHexChanged }: ColorPaletteProps) {
  const [nextLabel, setNextLabel] = useState('');
  const [showStashPicker, setShowStashPicker] = useState(false);
  const yarnQuery = useYarn();
  const yarns = (yarnQuery.data as StashYarn[] | undefined) ?? [];

  const yarnsById = useMemo(() => {
    const m = new Map<string, StashYarn>();
    for (const y of yarns) m.set(y.id, y);
    return m;
  }, [yarns]);

  const addColor = () => {
    const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const presetHex = DEFAULT_NEW_COLORS[colors.length % DEFAULT_NEW_COLORS.length];
    const label = nextLabel.trim() || (colors.length === 0 ? 'MC' : `CC${colors.length}`);
    onChange([...colors, { id, label, hex: presetHex, yarnId: null }]);
    setNextLabel('');
  };

  const addFromStash = (yarn: StashYarn) => {
    const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const label = colors.length === 0 ? 'MC' : `CC${colors.length}`;
    // Try to derive a hex from the yarn's color_code if it looks like one;
    // fall back to a preset from the default palette otherwise.
    const hex = /^#?[0-9a-fA-F]{6}$/.test(yarn.color_code ?? '')
      ? yarn.color_code!.startsWith('#')
        ? yarn.color_code!
        : `#${yarn.color_code}`
      : DEFAULT_NEW_COLORS[colors.length % DEFAULT_NEW_COLORS.length];
    const yarnName = [yarn.brand, yarn.name].filter(Boolean).join(' — ') || yarn.name;
    onChange([...colors, { id, label: `${label} · ${yarnName}`, hex, yarnId: yarn.id }]);
    setShowStashPicker(false);
  };

  const updateColor = (id: string, patch: Partial<ColorSwatch>) => {
    // If the hex is changing, notify the parent so painted chart cells
    // can be re-mapped from oldHex → newHex. Without this, swatches and
    // chart cells drift apart silently.
    if (patch.hex !== undefined && onHexChanged) {
      const prev = colors.find((c) => c.id === id);
      if (prev && prev.hex.toUpperCase() !== patch.hex.toUpperCase()) {
        onHexChanged(prev.hex, patch.hex);
      }
    }
    onChange(colors.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeColor = (id: string) => {
    onChange(colors.filter((c) => c.id !== id));
  };

  const unlinkYarn = (id: string) => {
    onChange(colors.map((c) => (c.id === id ? { ...c, yarnId: null } : c)));
  };

  return (
    <section className="rounded-lg bg-white p-4 shadow dark:bg-gray-800 md:p-6">
      <h2 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
        Colors <span className="text-xs font-normal text-gray-500">(optional)</span>
      </h2>
      <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
        Add the colors you plan to use. First color is the main color — the schematic tints to match.
      </p>

      <div className="space-y-2">
        {colors.map((c) => {
          const linkedYarn = c.yarnId ? yarnsById.get(c.yarnId) : null;
          return (
            <div
              key={c.id}
              className="rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/40"
            >
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={c.hex}
                  onChange={(e) => updateColor(c.id, { hex: e.target.value })}
                  className="h-10 w-12 shrink-0 cursor-pointer rounded border border-gray-300"
                  aria-label={`Pick hex for ${c.label}`}
                />
                <input
                  type="text"
                  value={c.label}
                  onChange={(e) => updateColor(c.id, { label: e.target.value })}
                  placeholder="label (e.g. MC, Cranberry)"
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
                <span className="hidden sm:inline text-xs font-mono text-gray-500">
                  {c.hex.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => removeColor(c.id)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600"
                  aria-label={`Remove ${c.label}`}
                  title="Remove color"
                >
                  <FiTrash2 className="h-4 w-4" />
                </button>
              </div>
              {linkedYarn && (
                <div className="mt-2 flex items-center gap-2 pl-14 text-xs text-gray-600 dark:text-gray-400">
                  <FiPackage className="h-3 w-3 text-purple-500" />
                  <span>
                    Linked yarn: {linkedYarn.brand ? `${linkedYarn.brand} — ` : ''}
                    {linkedYarn.name}
                    {linkedYarn.skeins_remaining !== null && (
                      <span className="ml-2 text-gray-400">
                        ({linkedYarn.skeins_remaining} skeins in stash)
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => unlinkYarn(c.id)}
                    className="ml-1 text-red-500 hover:text-red-700"
                    title="Unlink yarn"
                  >
                    <FiX className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={nextLabel}
          onChange={(e) => setNextLabel(e.target.value)}
          placeholder={colors.length === 0 ? 'First color name (default: MC)' : 'Next color name'}
          className="flex-1 min-w-[180px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addColor();
            }
          }}
        />
        <button
          type="button"
          onClick={addColor}
          className="flex items-center gap-1 rounded-lg bg-purple-600 px-3 py-2 text-sm text-white hover:bg-purple-700"
        >
          <FiPlus className="h-4 w-4" />
          Add color
        </button>
        <button
          type="button"
          onClick={() => setShowStashPicker((v) => !v)}
          disabled={yarnQuery.isLoading}
          className="flex items-center gap-1 rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm text-purple-700 hover:bg-purple-50 disabled:opacity-60"
          title="Pick a yarn from your stash"
        >
          <FiPackage className="h-4 w-4" />
          Add from stash
        </button>
      </div>

      {showStashPicker && (
        <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-purple-200 bg-white dark:border-purple-900/40 dark:bg-gray-800">
          {yarnQuery.isLoading ? (
            <p className="p-3 text-sm text-gray-500">Loading stash…</p>
          ) : yarns.length === 0 ? (
            <p className="p-3 text-sm text-gray-500">
              Your yarn stash is empty. Add yarns from the Yarn Stash page to link them here.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {yarns.map((y) => (
                <li key={y.id}>
                  <button
                    type="button"
                    onClick={() => addFromStash(y)}
                    className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-purple-50 dark:hover:bg-purple-900/20"
                  >
                    <span
                      className="mt-1 h-4 w-4 shrink-0 rounded border border-gray-300"
                      style={{
                        backgroundColor: /^#?[0-9a-fA-F]{6}$/.test(y.color_code ?? '')
                          ? y.color_code!.startsWith('#')
                            ? y.color_code!
                            : `#${y.color_code}`
                          : '#E5E7EB',
                      }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-sm">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {y.brand ? `${y.brand} — ` : ''}
                        {y.name}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {[y.color, y.weight, y.skeins_remaining !== null && `${y.skeins_remaining} skeins`]
                          .filter(Boolean)
                          .join(' · ') || 'no details'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
