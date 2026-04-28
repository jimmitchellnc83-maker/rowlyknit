/**
 * Tests for canonical pattern export — PR 7 of the Designer rebuild.
 *
 * The transformation is pure data shaping with a few branching rules
 * (chart-only suppresses parameters, text-only suppresses chart
 * references + legend, dialect resolution flows through). Tests lock
 * in those rules and the Markdown renderer's structural guarantees.
 */

import { describe, expect, it } from 'vitest';
import {
  buildPrintablePattern,
  renderPrintableAsMarkdown,
} from '../canonicalPatternExport';
import type { CanonicalPattern } from '../../types/pattern';

const samplePattern = (overrides: Partial<CanonicalPattern> = {}): CanonicalPattern => ({
  id: 'pat-1',
  userId: 'user-1',
  sourcePatternId: null,
  sourceProjectId: null,
  name: 'Sample Pattern',
  craft: 'knit',
  technique: 'cables',
  gaugeProfile: { stitches: 20, rows: 28, measurement: 4, unit: 'in' },
  sizeSet: { active: 's', sizes: [{ id: 's', label: 'M', measurements: {} }] },
  sections: [
    {
      id: 'sec-body',
      name: 'Body',
      kind: 'sweater-body',
      sortOrder: 0,
      parameters: { chestCircumference: 38, easeAtChest: 4, _totalRows: 120 },
      chartPlacement: {
        chartId: 'chart-1',
        repeatMode: 'tile',
        offset: { x: 0, y: 0 },
        layer: 0,
      },
      notes: 'Worked in the round',
    },
    {
      id: 'sec-sleeve',
      name: 'Sleeve',
      kind: 'sweater-sleeve',
      sortOrder: 1,
      parameters: { cuffCircumference: 8 },
      chartPlacement: null,
      notes: null,
    },
  ],
  legend: {
    overrides: {
      k: { symbol: 'k', nameOverride: 'Stockinette knit' },
    },
  },
  materials: [{ id: 'm1', name: 'MC', colorHex: '#000', kind: 'yarn' }],
  progressState: {},
  notes: 'Worked top-down',
  schemaVersion: 1,
  createdAt: '2026-04-28T00:00:00Z',
  updatedAt: '2026-04-28T00:00:00Z',
  deletedAt: null,
  ...overrides,
});

describe('buildPrintablePattern', () => {
  it('produces sections sorted by sortOrder', () => {
    const out = buildPrintablePattern(samplePattern(), { format: 'combined' });
    expect(out.sections.map((s) => s.id)).toEqual(['sec-body', 'sec-sleeve']);
  });

  it('humanizes section kind labels', () => {
    const out = buildPrintablePattern(samplePattern(), { format: 'combined' });
    expect(out.sections[0].humanKind).toBe('Sweater body');
    expect(out.sections[1].humanKind).toBe('Sleeve');
  });

  it('strips internal underscore-prefixed parameters', () => {
    const out = buildPrintablePattern(samplePattern(), { format: 'combined' });
    const keys = out.sections[0].parameterRows.map((r) => r.key);
    expect(keys).not.toContain('_totalRows');
    expect(keys).toContain('chestCircumference');
  });

  it('chart-only mode drops parameter rows', () => {
    const out = buildPrintablePattern(samplePattern(), { format: 'chart-only' });
    expect(out.sections[0].parameterRows).toEqual([]);
    expect(out.sections[1].parameterRows).toEqual([]);
  });

  it('text-only mode keeps parameters but drops chart references in the rendered output', () => {
    const out = buildPrintablePattern(samplePattern(), { format: 'text-only' });
    expect(out.sections[0].parameterRows.length).toBeGreaterThan(0);
    // chartReference is preserved in the structure (callers may want it),
    // but the Markdown renderer drops it in text-only mode.
    expect(out.sections[0].chartReference).toEqual({
      chartId: 'chart-1',
      repeatMode: 'tile',
      offsetSummary: 'x=0, y=0',
      layer: 0,
    });
  });

  it('returns null chartReference when the section has no chart placement', () => {
    const out = buildPrintablePattern(samplePattern(), { format: 'combined' });
    expect(out.sections[1].chartReference).toBeNull();
  });

  it('includes materials by default in combined and text-only modes', () => {
    const a = buildPrintablePattern(samplePattern(), { format: 'combined' });
    const b = buildPrintablePattern(samplePattern(), { format: 'text-only' });
    expect(a.materials).toHaveLength(1);
    expect(b.materials).toHaveLength(1);
  });

  it('drops materials in chart-only mode', () => {
    const out = buildPrintablePattern(samplePattern(), { format: 'chart-only' });
    expect(out.materials).toEqual([]);
  });

  it('respects includeMaterials=false', () => {
    const out = buildPrintablePattern(samplePattern(), {
      format: 'combined',
      includeMaterials: false,
    });
    expect(out.materials).toEqual([]);
  });

  it('respects includeNotes=false (drops section notes)', () => {
    const out = buildPrintablePattern(samplePattern(), {
      format: 'combined',
      includeNotes: false,
    });
    expect(out.sections[0].notes).toBeNull();
  });

  it('uses US dialect by default', () => {
    const out = buildPrintablePattern(
      samplePattern({ craft: 'crochet', technique: 'standard' }),
      { format: 'combined' },
    );
    expect(out.dialect).toBe('us');
  });

  it('resolves UK abbreviations on legend entries when dialect=uk', () => {
    const pattern = samplePattern({
      craft: 'crochet',
      technique: 'standard',
      legend: {
        overrides: {
          sc: { symbol: 'sc' }, // No name override; should use canonical name
          dc: { symbol: 'dc' },
        },
      },
    });
    const out = buildPrintablePattern(pattern, { format: 'combined', dialect: 'uk' });
    const abbrevsBySymbol = Object.fromEntries(
      out.legend.map((e) => [e.symbol, e.abbreviation]),
    );
    expect(abbrevsBySymbol.sc).toBe('dc'); // US "sc" = UK "dc"
    expect(abbrevsBySymbol.dc).toBe('tr'); // US "dc" = UK "tr"
  });

  it('formats gauge with optional tool size', () => {
    const out = buildPrintablePattern(
      samplePattern({
        gaugeProfile: {
          stitches: 18, rows: 24, measurement: 4, unit: 'in', toolSize: 'US 8',
        },
      }),
      { format: 'combined' },
    );
    expect(out.gauge).toBe('18 sts × 24 rows over 4 in (US 8)');
  });
});

describe('renderPrintableAsMarkdown', () => {
  it('starts with the pattern name as an H1', () => {
    const out = renderPrintableAsMarkdown(
      buildPrintablePattern(samplePattern(), { format: 'combined' }),
    );
    expect(out.startsWith('# Sample Pattern')).toBe(true);
  });

  it('includes craft + technique line', () => {
    const out = renderPrintableAsMarkdown(
      buildPrintablePattern(samplePattern(), { format: 'combined' }),
    );
    expect(out).toContain('**Knit** — cables');
  });

  it('includes Materials section when materials are present', () => {
    const out = renderPrintableAsMarkdown(
      buildPrintablePattern(samplePattern(), { format: 'combined' }),
    );
    expect(out).toContain('## Materials');
    expect(out).toContain('- MC (#000)');
  });

  it('includes Sections heading + per-section subheadings', () => {
    const out = renderPrintableAsMarkdown(
      buildPrintablePattern(samplePattern(), { format: 'combined' }),
    );
    expect(out).toContain('## Sections');
    expect(out).toContain('### Body — Sweater body');
    expect(out).toContain('### Sleeve — Sleeve');
  });

  it('drops chart references in text-only mode', () => {
    const out = renderPrintableAsMarkdown(
      buildPrintablePattern(samplePattern(), { format: 'text-only' }),
    );
    expect(out).not.toContain('Chart: chart-1');
  });

  it('keeps chart references in combined mode', () => {
    const out = renderPrintableAsMarkdown(
      buildPrintablePattern(samplePattern(), { format: 'combined' }),
    );
    expect(out).toContain('Chart: chart-1 (tile)');
  });

  it('drops the Legend section in text-only mode', () => {
    const out = renderPrintableAsMarkdown(
      buildPrintablePattern(samplePattern(), { format: 'text-only' }),
    );
    expect(out).not.toContain('## Legend');
  });

  it('includes Legend in combined + chart-only modes', () => {
    const a = renderPrintableAsMarkdown(
      buildPrintablePattern(samplePattern(), { format: 'combined' }),
    );
    const b = renderPrintableAsMarkdown(
      buildPrintablePattern(samplePattern(), { format: 'chart-only' }),
    );
    expect(a).toContain('## Legend');
    expect(b).toContain('## Legend');
  });

  it('marks UK terminology when dialect is uk and craft is crochet', () => {
    const out = renderPrintableAsMarkdown(
      buildPrintablePattern(
        samplePattern({ craft: 'crochet', technique: 'standard' }),
        { format: 'combined', dialect: 'uk' },
      ),
    );
    expect(out).toContain('Terminology: UK');
  });

  it('does NOT mark UK terminology for knit patterns even with dialect=uk', () => {
    const out = renderPrintableAsMarkdown(
      buildPrintablePattern(samplePattern(), { format: 'combined', dialect: 'uk' }),
    );
    expect(out).not.toContain('Terminology: UK');
  });
});
