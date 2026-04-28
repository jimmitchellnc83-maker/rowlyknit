/**
 * Tests for the per-pattern symbol overlay — PR 4 of the Designer
 * rebuild.
 *
 * These functions are pure and trivial individually; the tests lock in
 * the contracts the Designer page + chart engine rely on:
 *  - input arrays and legends are never mutated
 *  - empty/undefined legends pass through cleanly
 *  - both name and abbreviation are independently overridable
 *  - resolve* helpers fall back to the symbol's own fields when no
 *    override is present
 */

import { describe, it, expect } from 'vitest';
import {
  applyLegendOverrides,
  buildOverrideEntry,
  resolveDisplayAbbreviation,
  resolveDisplayName,
  upsertLegendEntry,
} from '../patternSymbolOverlay';
import type { ChartSymbolTemplate } from '../../types/chartSymbol';
import type { PatternLegend } from '../../types/pattern';

const baseSymbol = (overrides: Partial<ChartSymbolTemplate> = {}): ChartSymbolTemplate => ({
  id: 'sym-1',
  symbol: 'k',
  name: 'Knit',
  category: 'basic',
  description: null,
  variations: null,
  is_system: true,
  user_id: null,
  abbreviation: 'k',
  rs_instruction: 'k',
  ws_instruction: 'p',
  cell_span: 1,
  craft: 'knit',
  created_at: '2026-04-28T00:00:00Z',
  ...overrides,
});

describe('applyLegendOverrides', () => {
  it('returns the input unchanged when legend is null/undefined/empty', () => {
    const symbols = [baseSymbol(), baseSymbol({ symbol: 'p', name: 'Purl' })];
    expect(applyLegendOverrides(symbols, null)).toBe(symbols);
    expect(applyLegendOverrides(symbols, undefined)).toBe(symbols);
    expect(applyLegendOverrides(symbols, { overrides: {} })).toBe(symbols);
  });

  it('applies a name override', () => {
    const symbols = [baseSymbol()];
    const legend: PatternLegend = {
      overrides: { k: { symbol: 'k', nameOverride: 'Stockinette' } },
    };
    const out = applyLegendOverrides(symbols, legend);
    expect(out[0].name).toBe('Stockinette');
    expect(out[0].abbreviation).toBe('k');
  });

  it('applies an abbreviation override', () => {
    const symbols = [baseSymbol()];
    const legend: PatternLegend = {
      overrides: { k: { symbol: 'k', abbreviationOverride: 'kn' } },
    };
    const out = applyLegendOverrides(symbols, legend);
    expect(out[0].name).toBe('Knit');
    expect(out[0].abbreviation).toBe('kn');
  });

  it('applies name + abbreviation together', () => {
    const symbols = [baseSymbol()];
    const legend: PatternLegend = {
      overrides: {
        k: { symbol: 'k', nameOverride: 'Stockinette', abbreviationOverride: 'kn' },
      },
    };
    const out = applyLegendOverrides(symbols, legend);
    expect(out[0].name).toBe('Stockinette');
    expect(out[0].abbreviation).toBe('kn');
  });

  it('does not mutate the input symbol array or its members', () => {
    const symbols = [baseSymbol()];
    const before = symbols[0].name;
    const legend: PatternLegend = {
      overrides: { k: { symbol: 'k', nameOverride: 'Renamed' } },
    };
    applyLegendOverrides(symbols, legend);
    expect(symbols[0].name).toBe(before);
  });

  it('passes through symbols not present in the override map', () => {
    const symbols = [baseSymbol(), baseSymbol({ symbol: 'p', name: 'Purl' })];
    const legend: PatternLegend = {
      overrides: { k: { symbol: 'k', nameOverride: 'Knit-renamed' } },
    };
    const out = applyLegendOverrides(symbols, legend);
    expect(out[0].name).toBe('Knit-renamed');
    expect(out[1].name).toBe('Purl');
  });
});

describe('buildOverrideEntry', () => {
  it('returns null when both fields are blank/whitespace', () => {
    expect(buildOverrideEntry('k', null, null)).toBeNull();
    expect(buildOverrideEntry('k', '   ', '')).toBeNull();
  });

  it('trims trailing whitespace on both fields', () => {
    const entry = buildOverrideEntry('k', '  Stockinette  ', '  kn  ');
    expect(entry).toEqual({
      symbol: 'k',
      nameOverride: 'Stockinette',
      abbreviationOverride: 'kn',
    });
  });

  it('builds a name-only entry when the abbreviation is blank', () => {
    const entry = buildOverrideEntry('k', 'Stockinette', null);
    expect(entry).toEqual({
      symbol: 'k',
      nameOverride: 'Stockinette',
      abbreviationOverride: null,
    });
  });
});

describe('upsertLegendEntry', () => {
  it('creates a new legend when given undefined', () => {
    const out = upsertLegendEntry(undefined, 'k', {
      symbol: 'k',
      nameOverride: 'Stockinette',
    });
    expect(out.overrides).toEqual({
      k: { symbol: 'k', nameOverride: 'Stockinette' },
    });
  });

  it('inserts into an existing legend without mutating it', () => {
    const before: PatternLegend = {
      overrides: { p: { symbol: 'p', nameOverride: 'Purl wales' } },
    };
    const after = upsertLegendEntry(before, 'k', {
      symbol: 'k',
      abbreviationOverride: 'kn',
    });
    expect(after.overrides.p).toEqual(before.overrides.p);
    expect(after.overrides.k).toEqual({ symbol: 'k', abbreviationOverride: 'kn' });
    expect(before.overrides.k).toBeUndefined();
  });

  it('replaces an existing entry for the same symbol', () => {
    const before: PatternLegend = {
      overrides: { k: { symbol: 'k', nameOverride: 'Old' } },
    };
    const after = upsertLegendEntry(before, 'k', {
      symbol: 'k',
      nameOverride: 'New',
    });
    expect(after.overrides.k.nameOverride).toBe('New');
  });

  it('removes the entry when passed null', () => {
    const before: PatternLegend = {
      overrides: { k: { symbol: 'k', nameOverride: 'Old' } },
    };
    const after = upsertLegendEntry(before, 'k', null);
    expect(after.overrides.k).toBeUndefined();
  });
});

describe('resolveDisplayAbbreviation', () => {
  it('falls back to the symbol abbreviation when no override is present', () => {
    expect(resolveDisplayAbbreviation(baseSymbol(), null)).toBe('k');
    expect(
      resolveDisplayAbbreviation(baseSymbol({ abbreviation: null }), null),
    ).toBe('k'); // canonical key
  });

  it('returns the override abbreviation when present', () => {
    expect(
      resolveDisplayAbbreviation(baseSymbol(), {
        overrides: { k: { symbol: 'k', abbreviationOverride: 'kn' } },
      }),
    ).toBe('kn');
  });
});

describe('resolveDisplayName', () => {
  it('falls back to the symbol name when no override is present', () => {
    expect(resolveDisplayName(baseSymbol(), null)).toBe('Knit');
  });

  it('returns the override name when present', () => {
    expect(
      resolveDisplayName(baseSymbol(), {
        overrides: { k: { symbol: 'k', nameOverride: 'Stockinette' } },
      }),
    ).toBe('Stockinette');
  });
});
