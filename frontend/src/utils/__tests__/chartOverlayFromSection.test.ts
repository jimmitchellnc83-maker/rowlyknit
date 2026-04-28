/**
 * Tests for the canonical-section → ChartOverlay props adapter
 * (PR 8 of the Designer rebuild).
 */

import { describe, it, expect } from 'vitest';
import {
  chartOverlayPropsFromSection,
  chartOverlayPropsFromSectionWith,
} from '../chartOverlayFromSection';
import type { PatternSection } from '../../types/pattern';
import type { ExpandedRow, SectionRowSequence } from '../../types/repeat';

const baseSection = (overrides: Partial<PatternSection> = {}): PatternSection => ({
  id: 's1',
  name: 'Body',
  kind: 'sweater-body',
  sortOrder: 0,
  parameters: {},
  chartPlacement: null,
  notes: null,
  ...overrides,
});

const fakeExpandedRow = (rowNumber: number): ExpandedRow => ({
  rowNumber,
  tokens: [],
  source: { blockId: null, iteration: 1, positionInBody: 1, rowId: null },
  warnings: [],
});

describe('chartOverlayPropsFromSection', () => {
  it('returns null placement and no expandedRows when section has neither', () => {
    const result = chartOverlayPropsFromSection(baseSection());
    expect(result.placement).toBeNull();
    expect(result.expandedRows).toBeUndefined();
  });

  it('passes the section.chartPlacement through verbatim', () => {
    const placement = {
      chartId: 'chart-abc',
      repeatMode: 'single' as const,
      offset: { x: 2, y: 3 },
      layer: 1,
    };
    const result = chartOverlayPropsFromSection(baseSection({ chartPlacement: placement }));
    expect(result.placement).toBe(placement);
  });

  it('expands a structured _rowSequence under parameters into ExpandedRow[]', () => {
    // Tiny vertical-repeat sequence: two rows, repeated twice → 4 rows out.
    const sequence: SectionRowSequence = {
      items: [
        {
          kind: 'repeat',
          block: {
            kind: 'vertical',
            count: 2,
            body: [
              { id: 'r1', tokens: [{ kind: 'stitch', symbolId: 'k', cellSpan: 1 }] },
              { id: 'r2', tokens: [{ kind: 'stitch', symbolId: 'p', cellSpan: 1 }] },
            ],
          },
        },
      ],
    };
    const section = baseSection({
      parameters: { _rowSequence: sequence },
    });
    const result = chartOverlayPropsFromSection(section);
    expect(result.expandedRows).toBeDefined();
    expect(result.expandedRows!.length).toBe(4);
    // Row numbers are sequentially assigned.
    expect(result.expandedRows!.map((r) => r.rowNumber)).toEqual([1, 2, 3, 4]);
  });

  it('ignores a malformed _rowSequence and returns no expandedRows', () => {
    const section = baseSection({
      parameters: { _rowSequence: { items: 'not-an-array' } as unknown as SectionRowSequence },
    });
    const result = chartOverlayPropsFromSection(section);
    expect(result.expandedRows).toBeUndefined();
  });

  it('ignores _rowSequence when it is not an object', () => {
    const section = baseSection({ parameters: { _rowSequence: 42 } });
    const result = chartOverlayPropsFromSection(section);
    expect(result.expandedRows).toBeUndefined();
  });
});

describe('chartOverlayPropsFromSectionWith', () => {
  it('attaches a caller-supplied ExpandedRow[] alongside placement', () => {
    const rows = [fakeExpandedRow(1), fakeExpandedRow(2)];
    const placement = { chartId: 'c1', repeatMode: 'tile' as const };
    const result = chartOverlayPropsFromSectionWith(
      baseSection({ chartPlacement: placement }),
      rows,
    );
    expect(result.placement).toBe(placement);
    expect(result.expandedRows).toBe(rows);
  });

  it('preserves null placement when section has none', () => {
    const result = chartOverlayPropsFromSectionWith(baseSection(), [fakeExpandedRow(1)]);
    expect(result.placement).toBeNull();
    expect(result.expandedRows).toHaveLength(1);
  });
});
