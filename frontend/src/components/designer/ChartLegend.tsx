import { useMemo } from 'react';
import { useChartSymbols } from '../../hooks/useChartSymbols';
import { collectChartSymbols } from '../../utils/chartInstruction';
import { resolveStitchKey, StitchIcon } from '../../data/stitchSvgLibrary';
import type { ChartData } from './ChartGrid';
import type { ColorSwatch } from './ColorPalette';
import type { Craft } from '../../types/chartSymbol';

interface ChartLegendProps {
  chart: ChartData;
  craft: Craft;
  paletteColors: ColorSwatch[];
}

function collectUsedColors(chart: ChartData): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (let knitRow = 1; knitRow <= chart.height; knitRow++) {
    const cellRow = chart.height - knitRow;
    for (let c = 0; c < chart.width; c++) {
      const cell = chart.cells[cellRow * chart.width + c];
      if (!cell?.colorHex) continue;
      const key = cell.colorHex.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      order.push(cell.colorHex);
    }
  }
  return order;
}

function chartHasNoStitch(chart: ChartData): boolean {
  for (const cell of chart.cells) {
    if (!cell?.symbolId) continue;
    if ((resolveStitchKey(cell.symbolId) ?? cell.symbolId) === 'no-stitch') return true;
  }
  return false;
}

/**
 * Inline "Key" rendered next to the chart canvas. Lists every symbol and
 * color the chart actually uses, plus a one-liner when no-stitch cells
 * are present (since those don't appear in the symbol list — `collectChartSymbols`
 * filters them out).
 *
 * Returns null when the chart contributes nothing to a key (empty grid),
 * so it doesn't take up space on a fresh canvas.
 */
export default function ChartLegend({ chart, craft, paletteColors }: ChartLegendProps) {
  const palette = useChartSymbols(craft);

  const usedSymbols = useMemo(() => collectChartSymbols(chart), [chart]);
  const usedColors = useMemo(() => collectUsedColors(chart), [chart]);
  const hasNoStitch = useMemo(() => chartHasNoStitch(chart), [chart]);

  const bySymbol = useMemo(() => {
    if (!palette.data) return new Map<string, { name: string; abbreviation: string }>();
    return new Map(
      [...palette.data.system, ...palette.data.custom].map((t) => [
        t.symbol,
        { name: t.name, abbreviation: t.abbreviation },
      ]),
    );
  }, [palette.data]);

  const colorLabelByHex = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of paletteColors) {
      m.set(c.hex.toUpperCase(), c.label);
    }
    return m;
  }, [paletteColors]);

  if (usedSymbols.length === 0 && usedColors.length === 0 && !hasNoStitch) return null;

  return (
    <section
      className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/40"
      aria-label="Chart key"
    >
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
        Key
      </h3>

      {usedSymbols.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Symbols</div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {usedSymbols.map((symbol) => {
              const t = bySymbol.get(symbol);
              return (
                <li key={symbol} className="flex items-center gap-2">
                  <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-900">
                    <StitchIcon id={symbol} size={18} />
                  </span>
                  <span className="font-mono text-xs text-gray-700 dark:text-gray-200">
                    {t?.abbreviation ?? symbol}
                  </span>
                  {t?.name && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">— {t.name}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {usedColors.length > 0 && (
        <div className="mb-2">
          <div className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">Colors</div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {usedColors.map((hex) => {
              const label = colorLabelByHex.get(hex.toUpperCase()) ?? null;
              return (
                <li key={hex} className="flex items-center gap-2">
                  <span
                    className="inline-block h-4 w-4 flex-shrink-0 rounded border border-gray-300 dark:border-gray-600"
                    style={{ backgroundColor: hex }}
                    aria-hidden="true"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-200">
                    {label ?? <span className="font-mono">{hex.toUpperCase()}</span>}
                  </span>
                  {label && (
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                      {hex.toUpperCase()}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {hasNoStitch && (
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
          <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-gray-300 bg-gray-200 dark:border-gray-600 dark:bg-gray-700">
            <StitchIcon id="no-stitch" size={18} />
          </span>
          <span>No stitch — skip this cell, nothing is worked here.</span>
        </div>
      )}

      {palette.isLoading && usedSymbols.length > 0 && (
        <p className="mt-1 text-xs text-gray-400">Loading stitch names…</p>
      )}
    </section>
  );
}
