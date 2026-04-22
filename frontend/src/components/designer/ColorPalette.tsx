import { useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

export interface ColorSwatch {
  id: string;
  label: string;
  hex: string;
}

interface ColorPaletteProps {
  colors: ColorSwatch[];
  onChange: (next: ColorSwatch[]) => void;
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
export default function ColorPalette({ colors, onChange }: ColorPaletteProps) {
  const [nextLabel, setNextLabel] = useState('');

  const addColor = () => {
    const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const presetHex = DEFAULT_NEW_COLORS[colors.length % DEFAULT_NEW_COLORS.length];
    const label = nextLabel.trim() || (colors.length === 0 ? 'MC' : `CC${colors.length}`);
    onChange([...colors, { id, label, hex: presetHex }]);
    setNextLabel('');
  };

  const updateColor = (id: string, patch: Partial<ColorSwatch>) => {
    onChange(colors.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeColor = (id: string) => {
    onChange(colors.filter((c) => c.id !== id));
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
        {colors.map((c) => (
          <div key={c.id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900/40">
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
            <span className="hidden sm:inline text-xs font-mono text-gray-500">{c.hex.toUpperCase()}</span>
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
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={nextLabel}
          onChange={(e) => setNextLabel(e.target.value)}
          placeholder={colors.length === 0 ? 'First color name (default: MC)' : 'Next color name'}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
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
      </div>
    </section>
  );
}
