import { useState } from 'react';
import { FiDroplet, FiX, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { KNITTING_SYMBOLS, type KnittingSymbol } from '../../data/knittingSymbols';
import type { ColorSwatch } from './ColorPalette';
import type { ChartTool } from './ChartGrid';

interface StitchPaletteProps {
  tool: ChartTool;
  onChange: (next: ChartTool) => void;
  /** Colors from the shared ColorPalette — show these as "your palette"
   *  above the always-available default yarn colors. */
  paletteColors: ColorSwatch[];
}

/**
 * Stitch + color palette for the chart grid. Three rows:
 *   1. Default symbols row (most-used stitches) — always visible
 *   2. Expanded symbols (by category) — hidden behind a toggle
 *   3. Default color swatches + user's palette colors (both always usable)
 *      + the eraser.
 */

// Ordered list of the most-used stitches, grouped visually into: basic,
// increases/decreases, special.
const QUICK_SYMBOL_IDS = [
  'knit',
  'purl',
  'yarn_over',
  'k2tog',
  'ssk',
  'k3tog',
  'sssk',
  'slip',
  'no_stitch',
];

// Always-available color presets. Knitters typically work with a handful
// of staple colors (cream, charcoal, classic red, navy, etc.) — we surface
// those even before they customize their own palette, and the user's
// palette stacks in above.
const DEFAULT_COLORS: { label: string; hex: string }[] = [
  { label: 'White', hex: '#FFFFFF' },
  { label: 'Cream', hex: '#F5F1E3' },
  { label: 'Oatmeal', hex: '#D9CDB4' },
  { label: 'Charcoal', hex: '#3A3A3A' },
  { label: 'Black', hex: '#111111' },
  { label: 'Navy', hex: '#1E3A5F' },
  { label: 'Denim', hex: '#5A7EA4' },
  { label: 'Sky', hex: '#9EC4E5' },
  { label: 'Sage', hex: '#9BAE8C' },
  { label: 'Forest', hex: '#3E5D3A' },
  { label: 'Mustard', hex: '#D4A441' },
  { label: 'Rust', hex: '#A35134' },
  { label: 'Cranberry', hex: '#7E1B2E' },
  { label: 'Plum', hex: '#4D2E4A' },
  { label: 'Rose', hex: '#C68A8F' },
  { label: 'Pink', hex: '#E8A0B2' },
];

// Group stitches by category for the expanded view.
function groupByCategory(symbols: KnittingSymbol[]): Record<string, KnittingSymbol[]> {
  const groups: Record<string, KnittingSymbol[]> = {};
  for (const s of symbols) {
    if (QUICK_SYMBOL_IDS.includes(s.id)) continue;
    if (!groups[s.category]) groups[s.category] = [];
    groups[s.category].push(s);
  }
  return groups;
}

const CATEGORY_LABELS: Record<string, string> = {
  basic: 'Basic',
  decrease: 'Decreases',
  increase: 'Increases',
  cable: 'Cables',
  twisted: 'Twisted',
  special: 'Special',
  colorwork: 'Colorwork',
};

export default function StitchPalette({ tool, onChange, paletteColors }: StitchPaletteProps) {
  const activeSymbolId = tool.type === 'symbol' ? tool.symbolId : null;
  const activeColor = tool.type === 'color' ? tool.hex : null;
  const isErasing = tool.type === 'erase';
  const [expanded, setExpanded] = useState(false);
  const expandedGroups = groupByCategory(KNITTING_SYMBOLS);

  const renderSymbolButton = (id: string) => {
    const sym = KNITTING_SYMBOLS.find((s) => s.id === id);
    if (!sym) return null;
    const active = activeSymbolId === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => onChange({ type: 'symbol', symbolId: id })}
        title={`${sym.name} (${sym.abbreviation})`}
        className={`flex h-12 flex-col items-center justify-center rounded border px-1 text-[11px] transition ${
          active
            ? 'border-purple-600 bg-purple-50 text-purple-700 ring-1 ring-purple-400 dark:bg-purple-900/30 dark:text-purple-200'
            : 'border-gray-300 bg-white hover:border-purple-300 hover:bg-purple-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'
        }`}
      >
        <span
          className="text-lg leading-none"
          style={{ color: active ? undefined : sym.color ?? '#374151' }}
        >
          {sym.symbol}
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-tight opacity-70">
          {sym.abbreviation}
        </span>
      </button>
    );
  };

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Symbols
          </p>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 text-xs text-purple-600 hover:underline"
          >
            {expanded ? (
              <>
                <FiChevronUp className="h-3 w-3" /> Hide extras
              </>
            ) : (
              <>
                <FiChevronDown className="h-3 w-3" /> More symbols
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-5 gap-1 sm:grid-cols-9">
          {QUICK_SYMBOL_IDS.map(renderSymbolButton)}
        </div>

        {expanded && (
          <div className="mt-3 space-y-3">
            {Object.entries(expandedGroups).map(([cat, syms]) => (
              <div key={cat}>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
                  {CATEGORY_LABELS[cat] ?? cat}
                </p>
                <div className="grid grid-cols-5 gap-1 sm:grid-cols-9">
                  {syms.map((s) => renderSymbolButton(s.id))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <FiDroplet className="h-3 w-3" />
          Colors
        </p>

        {paletteColors.length > 0 && (
          <div className="mb-2">
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
              Your palette
            </p>
            <div className="flex flex-wrap gap-1">
              {paletteColors.map((c) => {
                const active = activeColor === c.hex;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChange({ type: 'color', hex: c.hex })}
                    title={c.label}
                    className={`flex h-10 w-10 items-center justify-center rounded border text-[10px] transition ${
                      active
                        ? 'border-purple-600 ring-2 ring-purple-400'
                        : 'border-gray-300 hover:border-purple-300 dark:border-gray-600'
                    }`}
                    style={{ backgroundColor: c.hex }}
                    aria-label={c.label}
                    aria-pressed={active}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-400">
            Defaults
          </p>
          <div className="flex flex-wrap gap-1">
            {DEFAULT_COLORS.map((c) => {
              const active = activeColor === c.hex;
              return (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => onChange({ type: 'color', hex: c.hex })}
                  title={c.label}
                  className={`flex h-10 w-10 items-center justify-center rounded border text-[10px] transition ${
                    active
                      ? 'border-purple-600 ring-2 ring-purple-400'
                      : 'border-gray-300 hover:border-purple-300 dark:border-gray-600'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  aria-label={c.label}
                  aria-pressed={active}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="pt-1 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange({ type: 'erase' })}
          className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm transition ${
            isErasing
              ? 'border-red-600 bg-red-50 text-red-700 ring-1 ring-red-300 dark:bg-red-900/30 dark:text-red-200'
              : 'border-gray-300 bg-white text-gray-700 hover:border-red-300 hover:bg-red-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200'
          }`}
        >
          <FiX className="h-4 w-4" />
          Erase
        </button>
        <span className="text-xs text-gray-500">
          Click / drag on the grid to paint.
        </span>
      </div>
    </div>
  );
}
