import { describe, it, expect } from 'vitest';
import { computeCustomDraft, type DesignerGauge } from './designerMath';
import type { CustomDraft } from '../types/customDraft';

const STANDARD_GAUGE: DesignerGauge = {
  stitchesPer4in: 20,
  rowsPer4in: 28,
};

function makeDraft(overrides: Partial<CustomDraft> = {}): CustomDraft {
  return {
    craftMode: 'hand',
    startingStitches: 100,
    sections: [],
    ...overrides,
  };
}

describe('computeCustomDraft', () => {
  it('handles an empty draft (no sections)', () => {
    const out = computeCustomDraft({ draft: makeDraft({ sections: [] }), gauge: STANDARD_GAUGE });
    expect(out.sections).toEqual([]);
    expect(out.totalRows).toBe(0);
    expect(out.finalStitches).toBe(100);
    expect(out.warnings).toEqual([]);
  });

  it('threads stitch counts through straight + decrease + bind off sections', () => {
    const out = computeCustomDraft({
      draft: makeDraft({
        startingStitches: 100,
        sections: [
          { id: 's1', name: 'Body', type: 'straight', rows: 50, changePerSide: 0, note: '' },
          { id: 's2', name: 'Shape', type: 'decrease', rows: 20, changePerSide: 8, note: '' },
          { id: 's3', name: 'BO', type: 'bind_off', rows: 1, changePerSide: 0, note: '' },
        ],
      }),
      gauge: STANDARD_GAUGE,
    });
    expect(out.sections.length).toBe(3);
    expect(out.sections[0].startStitches).toBe(100);
    expect(out.sections[0].endStitches).toBe(100);
    // Decrease 8 each side = -16 total
    expect(out.sections[1].startStitches).toBe(100);
    expect(out.sections[1].endStitches).toBe(84);
    // Bind off zeros it
    expect(out.sections[2].startStitches).toBe(84);
    expect(out.sections[2].endStitches).toBe(0);
    expect(out.totalRows).toBe(71);
    expect(out.finalStitches).toBe(0);
  });

  it('computes 1-indexed row ranges per section', () => {
    const out = computeCustomDraft({
      draft: makeDraft({
        sections: [
          { id: 's1', name: 'A', type: 'straight', rows: 10, changePerSide: 0, note: '' },
          { id: 's2', name: 'B', type: 'straight', rows: 5, changePerSide: 0, note: '' },
          { id: 's3', name: 'C', type: 'straight', rows: 3, changePerSide: 0, note: '' },
        ],
      }),
      gauge: STANDARD_GAUGE,
    });
    expect(out.sections[0]).toMatchObject({ startRow: 1, endRow: 10 });
    expect(out.sections[1]).toMatchObject({ startRow: 11, endRow: 15 });
    expect(out.sections[2]).toMatchObject({ startRow: 16, endRow: 18 });
  });

  it('warns and clamps when shaping reduces below zero', () => {
    const out = computeCustomDraft({
      draft: makeDraft({
        startingStitches: 10,
        sections: [
          { id: 's1', name: 'Aggressive', type: 'decrease', rows: 5, changePerSide: 8, note: '' },
        ],
      }),
      gauge: STANDARD_GAUGE,
    });
    expect(out.sections[0].endStitches).toBe(0);
    expect(out.warnings).toHaveLength(1);
    expect(out.warnings[0]).toMatch(/below zero/i);
  });

  it('hand-knitting instructions use "work" + "bind off"', () => {
    const out = computeCustomDraft({
      draft: makeDraft({
        craftMode: 'hand',
        sections: [
          { id: 's1', name: 'BO', type: 'bind_off', rows: 1, changePerSide: 0, note: '' },
          { id: 's2', name: 'Plain', type: 'straight', rows: 20, changePerSide: 0, note: '' },
        ],
      }),
      gauge: STANDARD_GAUGE,
    });
    expect(out.sections[0].instruction.toLowerCase()).toContain('bind off');
    expect(out.sections[1].instruction.toLowerCase()).toMatch(/work \d+ rows/);
  });

  it('machine-knitting instructions use "knit" + "cast off"', () => {
    const out = computeCustomDraft({
      draft: makeDraft({
        craftMode: 'machine',
        sections: [
          { id: 's1', name: 'BO', type: 'bind_off', rows: 1, changePerSide: 0, note: '' },
          { id: 's2', name: 'Plain', type: 'straight', rows: 20, changePerSide: 0, note: '' },
        ],
      }),
      gauge: STANDARD_GAUGE,
    });
    expect(out.sections[0].instruction.toLowerCase()).toContain('cast off');
    expect(out.sections[1].instruction.toLowerCase()).toMatch(/knit \d+ rows/);
  });

  it('cast_off_each_side reduces 2× changePerSide and includes "remaining" rows phrasing', () => {
    const out = computeCustomDraft({
      draft: makeDraft({
        startingStitches: 100,
        sections: [
          {
            id: 's1',
            name: 'Armhole',
            type: 'cast_off_each_side',
            rows: 4,
            changePerSide: 6,
            note: '',
          },
        ],
      }),
      gauge: STANDARD_GAUGE,
    });
    expect(out.sections[0].endStitches).toBe(88);
    expect(out.sections[0].instruction).toMatch(/2 remaining rows/);
  });

  it('computes width + height in inches from gauge', () => {
    const out = computeCustomDraft({
      draft: makeDraft({
        startingStitches: 100,
        sections: [
          { id: 's1', name: 'A', type: 'straight', rows: 28, changePerSide: 0, note: '' },
        ],
      }),
      gauge: STANDARD_GAUGE,
    });
    // 100 sts ÷ 5 sts/in = 20 in wide
    expect(out.startingWidthInches).toBe(20);
    // 28 rows ÷ 7 rows/in = 4 in tall
    expect(out.totalHeightInches).toBe(4);
  });
});
