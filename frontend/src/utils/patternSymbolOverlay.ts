/**
 * Per-pattern symbol overlay — PR 4 of the Designer rebuild.
 *
 * The canonical Pattern model (`pattern_models.legend.overrides`) lets
 * a designer rename, re-abbreviate, or otherwise adjust the display of
 * a system or custom symbol *for one pattern only* without forking the
 * symbol library. The overlay layer here is the read-side bridge:
 * given a global symbol palette + a pattern-level legend, it returns a
 * new palette where each symbol's display fields reflect the active
 * overrides.
 *
 * This module is pure — no I/O, no React. The Designer page calls it
 * after `useChartSymbols` returns, before passing the palette to chart
 * rendering or `chartInstruction`.
 */

import type { ChartSymbolTemplate } from '../types/chartSymbol';
import type { LegendEntry, PatternLegend } from '../types/pattern';

/**
 * Apply pattern-level legend overrides on top of a base symbol list.
 *
 * Each override may rewrite the symbol's `name` and/or `abbreviation`.
 * Other fields (RS/WS instructions, cell_span, craft, etc.) are NOT
 * overridable at the pattern level — those are global stitch
 * properties that should not silently change between patterns.
 *
 * Returns a new array; the input is never mutated. Symbols not present
 * in the override map pass through unchanged.
 */
export function applyLegendOverrides(
  symbols: ChartSymbolTemplate[],
  legend: PatternLegend | null | undefined,
): ChartSymbolTemplate[] {
  if (!legend || !legend.overrides) return symbols;
  const overrides = legend.overrides;
  if (Object.keys(overrides).length === 0) return symbols;

  return symbols.map((s) => {
    const o = overrides[s.symbol];
    if (!o) return s;
    return {
      ...s,
      name: o.nameOverride ?? s.name,
      abbreviation: o.abbreviationOverride ?? s.abbreviation,
    };
  });
}

/**
 * Build a single override entry for a symbol. Convenience constructor
 * the Designer UI uses when a knitter renames a symbol in the legend.
 * Returns null when both fields are blank — the caller should drop the
 * entry from the legend in that case.
 */
export function buildOverrideEntry(
  symbol: string,
  nameOverride: string | null,
  abbreviationOverride: string | null,
): LegendEntry | null {
  const trimmedName = nameOverride?.trim() || null;
  const trimmedAbbrev = abbreviationOverride?.trim() || null;
  if (!trimmedName && !trimmedAbbrev) return null;
  return {
    symbol,
    nameOverride: trimmedName,
    abbreviationOverride: trimmedAbbrev,
  };
}

/**
 * Merge a single override entry into an existing legend (or create a
 * new legend if none was provided). Returns a new PatternLegend; the
 * input is never mutated. Pass `entry === null` to remove the override
 * for the given symbol.
 */
export function upsertLegendEntry(
  legend: PatternLegend | null | undefined,
  symbol: string,
  entry: LegendEntry | null,
): PatternLegend {
  const base: PatternLegend = legend ?? { overrides: {} };
  const next = { ...base.overrides };
  if (entry === null) {
    delete next[symbol];
  } else {
    next[symbol] = entry;
  }
  return { overrides: next };
}

/**
 * Resolve the display abbreviation for a symbol given a (possibly
 * undefined) legend. Falls back to the symbol's stored abbreviation,
 * then to the canonical `symbol` key. Used by the chart renderer and
 * the instruction text engine.
 */
export function resolveDisplayAbbreviation(
  symbol: ChartSymbolTemplate,
  legend: PatternLegend | null | undefined,
): string {
  const override = legend?.overrides?.[symbol.symbol];
  if (override?.abbreviationOverride) return override.abbreviationOverride;
  return symbol.abbreviation ?? symbol.symbol;
}

/**
 * Resolve the display name for a symbol given a (possibly undefined)
 * legend. Falls back to the symbol's stored name.
 */
export function resolveDisplayName(
  symbol: ChartSymbolTemplate,
  legend: PatternLegend | null | undefined,
): string {
  const override = legend?.overrides?.[symbol.symbol];
  if (override?.nameOverride) return override.nameOverride;
  return symbol.name;
}
