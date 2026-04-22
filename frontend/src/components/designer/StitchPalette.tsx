import { FiDroplet, FiX } from 'react-icons/fi';
import { KNITTING_SYMBOLS } from '../../data/knittingSymbols';
import type { ColorSwatch } from './ColorPalette';
import type { ChartTool } from './ChartGrid';

interface StitchPaletteProps {
  tool: ChartTool;
  onChange: (next: ChartTool) => void;
  /** Colors from the shared ColorPalette — available for colorwork cells. */
  paletteColors: ColorSwatch[];
}

/**
 * Side-by-side palette: left column picks a stitch symbol, right column
 * picks a palette color (for colorwork), plus an eraser. The active tool is
 * highlighted; clicking the same tool twice is a no-op.
 *
 * Only the most-used symbols are shown here — the full KNITTING_SYMBOLS
 * library has 40+ entries and would overwhelm a beginner. A future PR can
 * add an "expand / categories" toggle to reveal the rest.
 */

// Subset of KNITTING_SYMBOLS we surface by default.
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

export default function StitchPalette({ tool, onChange, paletteColors }: StitchPaletteProps) {
  const activeSymbolId = tool.type === 'symbol' ? tool.symbolId : null;
  const activeColor = tool.type === 'color' ? tool.hex : null;
  const isErasing = tool.type === 'erase';

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Symbols
        </p>
        <div className="grid grid-cols-6 gap-1 sm:grid-cols-9">
          {QUICK_SYMBOL_IDS.map((id) => {
            const sym = KNITTING_SYMBOLS.find((s) => s.id === id);
            if (!sym) return null;
            const active = activeSymbolId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onChange({ type: 'symbol', symbolId: id })}
                title={`${sym.name} (${sym.abbreviation})`}
                className={`flex h-10 flex-col items-center justify-center rounded border text-[11px] transition ${
                  active
                    ? 'border-purple-600 bg-purple-50 text-purple-700 ring-1 ring-purple-400 dark:bg-purple-900/30 dark:text-purple-200'
                    : 'border-gray-300 bg-white hover:border-purple-300 hover:bg-purple-50 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'
                }`}
              >
                <span
                  className="text-base leading-none"
                  style={{ color: active ? undefined : sym.color ?? '#374151' }}
                >
                  {sym.symbol}
                </span>
                <span className="mt-0.5 text-[9px] uppercase tracking-tight opacity-70">
                  {sym.abbreviation}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <FiDroplet className="h-3 w-3" />
          Colors (from palette)
        </p>
        {paletteColors.length === 0 ? (
          <p className="rounded border border-dashed border-gray-300 p-2 text-xs text-gray-500 dark:border-gray-700">
            Add colors to your palette above to paint colorwork cells.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {paletteColors.map((c) => {
              const active = activeColor === c.hex;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange({ type: 'color', hex: c.hex })}
                  title={c.label}
                  className={`flex h-9 w-9 items-center justify-center rounded border text-[10px] transition ${
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
        )}
      </div>

      <div className="pt-1">
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
        <span className="ml-3 text-xs text-gray-500">
          Click / drag cells on the grid to paint.
        </span>
      </div>
    </div>
  );
}
