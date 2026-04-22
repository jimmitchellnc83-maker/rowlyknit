import { describe, it, expect } from 'vitest';
import {
  buildShapingFormula,
  computeBodyBlock,
  computeSleeve,
  toInches,
  type BodyBlockInput,
  type DesignerGauge,
  type SleeveInput,
} from './designerMath';

const STANDARD_GAUGE: DesignerGauge = {
  stitchesPer4in: 20,
  rowsPer4in: 28,
};

describe('toInches', () => {
  it('leaves inch measurements unchanged', () => {
    expect(toInches(10, 'in')).toBe(10);
  });
  it('converts cm to inches', () => {
    expect(toInches(25.4, 'cm')).toBeCloseTo(10, 5);
  });
});

describe('buildShapingFormula', () => {
  it('reports a straight section when stitch counts match', () => {
    const f = buildShapingFormula(100, 100, 40);
    expect(f.direction).toBe('none');
    expect(f.events).toBe(0);
    expect(f.instruction).toBe('Work straight for 40 rows.');
  });

  it('uses singular "row" when the total is 1', () => {
    expect(buildShapingFormula(100, 100, 1).instruction).toBe('Work straight for 1 row.');
  });

  it('builds a decrease formula with trailing straight rows', () => {
    // Decrease 14 sts total (7 events) over 60 rows → 1 event every 8 rows, 4 straight trailing
    const f = buildShapingFormula(100, 86, 60);
    expect(f.direction).toBe('decrease');
    expect(f.events).toBe(7);
    expect(f.rowsBetween).toBe(8);
    expect(f.trailingStraight).toBe(4);
    expect(f.instruction).toContain('DEC 1 st each end every 8 rows × 7');
    expect(f.instruction).toContain('then work 4 rows straight');
    expect(f.instruction).toContain('decrease 14 sts total');
  });

  it('builds an increase formula without trailing when even-division', () => {
    // 7 events × 6 rows apart = 42 rows exactly, no trailing
    const f = buildShapingFormula(86, 100, 42);
    expect(f.direction).toBe('increase');
    expect(f.events).toBe(7);
    expect(f.rowsBetween).toBe(6);
    expect(f.trailingStraight).toBe(0);
    expect(f.instruction).toContain('INC 1 st each end every 6 rows × 7');
    expect(f.instruction).not.toContain('straight');
    expect(f.instruction).toContain('increase 14 sts total');
  });

  it('enforces a minimum 2-row spacing between events', () => {
    // Try to cram 50 events into 40 rows — floor(40/50) would be 0, clamp to 2
    const f = buildShapingFormula(200, 100, 40);
    expect(f.rowsBetween).toBeGreaterThanOrEqual(2);
  });

  it('returns a zero-event section when totalRows <= 0', () => {
    const f = buildShapingFormula(100, 90, 0);
    expect(f.events).toBe(0);
    expect(f.instruction).toContain('Skip');
  });

  it('rounds down to an even stitch-count diff', () => {
    // 101 - 100 = 1 stitch diff → floor(1/2) = 0 events → treated as straight
    const f = buildShapingFormula(101, 100, 40);
    expect(f.events).toBe(0);
    expect(f.instruction).toContain('straight');
  });
});

describe('computeBodyBlock — straight (no waist shaping)', () => {
  const baseInput: BodyBlockInput = {
    gauge: STANDARD_GAUGE,
    chestCircumference: 36,
    easeAtChest: 4,
    totalLength: 24,
    hemDepth: 2,
  };

  it('casts on the correct (even) stitch count for a panel at chest+ease', () => {
    const out = computeBodyBlock(baseInput);
    // Panel width = 40/2 = 20 in; 20 × (20/4) = 100 sts
    expect(out.castOnStitches).toBe(100);
  });

  it('produces three steps: hem, body, bind off', () => {
    const out = computeBodyBlock(baseInput);
    const labels = out.steps.map((s) => s.label);
    expect(labels).toEqual(['Hem', 'Hem to shoulder', 'Bind off']);
  });

  it('computes the expected row counts', () => {
    const out = computeBodyBlock(baseInput);
    // 2 in × 7 rows/in = 14 hem rows; 24 in total × 7 = 168 total; body = 154
    expect(out.hemRows).toBe(14);
    expect(out.totalRows).toBe(168);
    expect(out.steps[1].rows).toBe(154);
  });

  it('keeps stitch counts constant across all body steps when no waist', () => {
    const out = computeBodyBlock(baseInput);
    out.steps.slice(0, 2).forEach((s) => {
      expect(s.startStitches).toBe(100);
      expect(s.endStitches).toBe(100);
      expect(s.direction).toBe('none');
    });
  });

  it('binds off the full stitch count', () => {
    const out = computeBodyBlock(baseInput);
    const bindOff = out.steps[out.steps.length - 1];
    expect(bindOff.label).toBe('Bind off');
    expect(bindOff.startStitches).toBe(100);
    expect(bindOff.endStitches).toBe(0);
  });

  it('records finished measurements without the ease confusion', () => {
    const out = computeBodyBlock(baseInput);
    expect(out.finishedChest).toBe(40);
    expect(out.finishedLength).toBe(24);
    expect(out.finishedWaist).toBeNull();
  });
});

describe('computeBodyBlock — with waist shaping', () => {
  const waistInput: BodyBlockInput = {
    gauge: STANDARD_GAUGE,
    chestCircumference: 36,
    easeAtChest: 4,
    totalLength: 24,
    hemDepth: 2,
    waist: {
      waistCircumference: 30,
      easeAtWaist: 2,
      waistHeightFromHem: 8, // waist is 8 in up from cast-on
    },
  };

  it('generates hem, below-waist, above-waist, and bind-off steps', () => {
    const out = computeBodyBlock(waistInput);
    const labels = out.steps.map((s) => s.label);
    expect(labels).toEqual(['Hem', 'Hem to waist', 'Waist to bust', 'Bind off']);
  });

  it('narrows to the waist and widens back out to chest', () => {
    const out = computeBodyBlock(waistInput);
    // Waist panel width = 32/2 = 16 in; 16 × (20/4) = 80 sts
    const below = out.steps.find((s) => s.label === 'Hem to waist')!;
    const above = out.steps.find((s) => s.label === 'Waist to bust')!;
    expect(below.startStitches).toBe(100);
    expect(below.endStitches).toBe(80);
    expect(below.direction).toBe('decrease');
    expect(above.startStitches).toBe(80);
    expect(above.endStitches).toBe(100);
    expect(above.direction).toBe('increase');
  });

  it('exposes the finished waist measurement for labels', () => {
    const out = computeBodyBlock(waistInput);
    expect(out.finishedWaist).toBe(32);
  });

  it('splits the body rows between below-waist and above-waist sections', () => {
    const out = computeBodyBlock(waistInput);
    const below = out.steps.find((s) => s.label === 'Hem to waist')!;
    const above = out.steps.find((s) => s.label === 'Waist to bust')!;
    // hemRows=14, waistFromHem=8in → 56 total rows to waist; below = 56-14 = 42
    expect(below.rows).toBe(42);
    // above = totalRows - hemRows - belowRows = 168 - 14 - 42 = 112
    expect(above.rows).toBe(112);
  });

  it('produces a decrease instruction that mentions the ratio', () => {
    const out = computeBodyBlock(waistInput);
    const below = out.steps.find((s) => s.label === 'Hem to waist')!;
    // 100 → 80 = 20 st diff = 10 events over 42 rows → 4 rows between, 2 trailing
    expect(below.instruction).toContain('DEC 1 st each end every 4 rows × 10');
    expect(below.instruction).toContain('then work 2 rows straight');
  });
});

describe('computeSleeve', () => {
  const baseInput: SleeveInput = {
    gauge: STANDARD_GAUGE,
    cuffCircumference: 7,
    easeAtCuff: 1,
    bicepCircumference: 12,
    easeAtBicep: 2,
    cuffToUnderarmLength: 18,
    cuffDepth: 2,
  };

  it('casts on cuff stitches rounded to even', () => {
    const out = computeSleeve(baseInput);
    // Cuff = 8 in circumference → 8 × 5 = 40 sts (already even)
    expect(out.castOnStitches).toBe(40);
  });

  it('computes bicep stitches for end of taper', () => {
    const out = computeSleeve(baseInput);
    // Bicep = 14 in → 14 × 5 = 70 sts
    expect(out.bicepStitches).toBe(70);
  });

  it('generates cuff / taper / underarm steps', () => {
    const out = computeSleeve(baseInput);
    const labels = out.steps.map((s) => s.label);
    expect(labels).toEqual(['Cuff', 'Taper to bicep', 'Underarm']);
  });

  it('rounds row counts correctly from length + gauge', () => {
    const out = computeSleeve(baseInput);
    // 18 in × 7 rows/in = 126 total rows; 2 in hem × 7 = 14 cuff rows
    expect(out.totalRows).toBe(126);
    expect(out.cuffRows).toBe(14);
    expect(out.steps[1].rows).toBe(112);
  });

  it('produces an increase formula for the taper', () => {
    const out = computeSleeve(baseInput);
    const taper = out.steps.find((s) => s.label === 'Taper to bicep')!;
    // 40 → 70 = 30 st diff = 15 events over 112 rows → 7 between, 7 trailing
    expect(taper.direction).toBe('increase');
    expect(taper.instruction).toContain('INC 1 st each end every 7 rows × 15');
    expect(taper.instruction).toContain('then work 7 rows straight');
  });

  it('reports finished measurements for the schematic', () => {
    const out = computeSleeve(baseInput);
    expect(out.finishedCuff).toBe(8);
    expect(out.finishedBicep).toBe(14);
    expect(out.finishedLength).toBe(18);
  });

  it('handles a no-taper straight sleeve (cuff equals bicep)', () => {
    const out = computeSleeve({
      ...baseInput,
      cuffCircumference: 12,
      bicepCircumference: 12,
      easeAtCuff: 2,
      easeAtBicep: 2,
    });
    const taper = out.steps.find((s) => s.label === 'Taper to bicep')!;
    expect(taper.startStitches).toBe(taper.endStitches);
    expect(taper.direction).toBe('none');
    expect(taper.instruction).toContain('straight');
  });

  it('skips the taper step when cuff depth equals total length', () => {
    const out = computeSleeve({
      ...baseInput,
      cuffToUnderarmLength: 2,
      cuffDepth: 2,
    });
    // With cuffRows === totalRows, taperRows is 0 → no "Taper to bicep" step
    const labels = out.steps.map((s) => s.label);
    expect(labels).toEqual(['Cuff', 'Underarm']);
  });

  it('mentions holding stitches when the sleeve will join a yoke', () => {
    const out = computeSleeve(baseInput);
    const underarm = out.steps.find((s) => s.label === 'Underarm')!;
    expect(underarm.instruction).toContain('holder');
  });
});
