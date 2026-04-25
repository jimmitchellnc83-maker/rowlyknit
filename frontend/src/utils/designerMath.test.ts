import { describe, it, expect } from 'vitest';
import {
  buildShapingFormula,
  computeBlanket,
  computeBodyBlock,
  computeHat,
  computeMittens,
  computeScarf,
  computeShawl,
  computeSleeve,
  computeSocks,
  formatLength,
  toInches,
  type BlanketInput,
  type BodyBlockInput,
  type DesignerGauge,
  type HatInput,
  type MittenInput,
  type ScarfInput,
  type ShawlInput,
  type SleeveInput,
  type SockInput,
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

describe('formatLength', () => {
  it('passes inches through with an "in" suffix', () => {
    expect(formatLength(36, 'in')).toBe('36 in');
    expect(formatLength(36.25, 'in')).toBe('36.25 in');
  });
  it('converts inches to cm and rounds to nearest 0.5', () => {
    expect(formatLength(36, 'cm')).toBe('91.5 cm');
    expect(formatLength(10, 'cm')).toBe('25.5 cm');
  });
  it('handles zero', () => {
    expect(formatLength(0, 'in')).toBe('0 in');
    expect(formatLength(0, 'cm')).toBe('0 cm');
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

describe('computeBodyBlock with armhole shaping', () => {
  const base: BodyBlockInput = {
    gauge: STANDARD_GAUGE,
    chestCircumference: 36,
    easeAtChest: 4,
    totalLength: 24,
    hemDepth: 2,
    armhole: {
      armholeDepth: 8,
      shoulderWidth: 5,
    },
  };

  it('splits body core and armhole rows correctly', () => {
    const out = computeBodyBlock(base);
    // totalRows = 168, hemRows = 14, armholeRows = 8 × 7 = 56
    // bodyCoreRows = 168 - 14 - 56 = 98
    const hemToArmhole = out.steps.find((s) => s.label === 'Hem to armhole')!;
    expect(hemToArmhole).toBeTruthy();
    expect(hemToArmhole.rows).toBe(98);
  });

  it('emits initial armhole bind-off with an even stitch count', () => {
    const out = computeBodyBlock(base);
    expect(out.armholeInitialBindOffPerSide).toBeGreaterThanOrEqual(2);
    expect((out.armholeInitialBindOffPerSide ?? 0) % 2).toBe(0);
    const init = out.steps.find((s) => s.label === 'Armhole — initial bind-off')!;
    expect(init.rows).toBe(2);
    expect(init.instruction).toContain('next 2 rows');
  });

  it('tapers from post-bind-off to shoulder seam stitches', () => {
    const out = computeBodyBlock(base);
    const taper = out.steps.find((s) => s.label === 'Armhole — taper')!;
    expect(taper.direction).toBe('decrease');
    expect(out.shoulderSeamStitches).toBe(taper.endStitches);
  });

  it('uses a single shoulder bind-off step when no neckline is requested', () => {
    const out = computeBodyBlock(base);
    const finalStep = out.steps[out.steps.length - 1];
    expect(finalStep.label).toBe('Shoulder bind-off');
    expect(finalStep.instruction).toMatch(/bind off all/i);
  });
});

describe('computeBodyBlock with armhole + crew neckline (front panel)', () => {
  const frontInput: BodyBlockInput = {
    gauge: STANDARD_GAUGE,
    chestCircumference: 36,
    easeAtChest: 4,
    totalLength: 24,
    hemDepth: 2,
    armhole: {
      armholeDepth: 8,
      shoulderWidth: 5,
    },
    neckline: {
      necklineDepth: 2.5,
      neckOpeningWidth: 7,
    },
  };

  it('reserves neck-opening stitches in the shoulder seam total', () => {
    const out = computeBodyBlock(frontInput);
    // 2 × 5-in shoulder + 7-in neck opening = 17 in across shoulders × 5 sts/in = ~85 sts
    expect(out.shoulderSeamStitches).toBeGreaterThan(60);
    expect(out.shoulderSeamStitches).toBeLessThan(100);
  });

  it('emits a neckline center bind-off step', () => {
    const out = computeBodyBlock(frontInput);
    const center = out.steps.find((s) => s.label === 'Neckline — center bind-off')!;
    expect(center).toBeTruthy();
    expect(center.instruction).toContain('each shoulder separately');
  });

  it('curves each shoulder with a few neck-edge decreases', () => {
    const out = computeBodyBlock(frontInput);
    const curve = out.steps.find((s) => s.label === 'Neckline — shape each shoulder')!;
    expect(curve).toBeTruthy();
    expect(curve.instruction).toMatch(/dec 1 st at neck edge/i);
  });

  it('finishes with per-shoulder bind-off when neckline is present', () => {
    const out = computeBodyBlock(frontInput);
    const finalStep = out.steps[out.steps.length - 1];
    expect(finalStep.label).toBe('Shoulder bind-off');
    expect(finalStep.instruction).toMatch(/each shoulder/i);
  });
});

describe('computeSleeve with cap shaping', () => {
  const capInput: SleeveInput = {
    gauge: STANDARD_GAUGE,
    cuffCircumference: 7,
    easeAtCuff: 1,
    bicepCircumference: 12,
    easeAtBicep: 2,
    cuffToUnderarmLength: 18,
    cuffDepth: 2,
    cap: {
      matchingArmholeDepth: 8,
      matchingArmholeInitialBindOff: 4,
    },
  };

  it('adds three cap steps (initial bind-off, taper, top bind-off)', () => {
    const out = computeSleeve(capInput);
    const capLabels = out.steps.filter((s) => s.label.startsWith('Cap')).map((s) => s.label);
    expect(capLabels).toEqual([
      'Cap — initial bind-off',
      'Cap — taper',
      'Cap — top bind-off',
    ]);
  });

  it('matches the body armhole initial bind-off for seam alignment', () => {
    const out = computeSleeve(capInput);
    const init = out.steps.find((s) => s.label === 'Cap — initial bind-off')!;
    // 70 bicep - 8 (2 × 4) = 62 post-bind-off
    expect(init.startStitches).toBe(70);
    expect(init.endStitches).toBe(62);
    expect(init.instruction).toContain('4 sts');
  });

  it('tapers to a narrow top edge (~2 in wide)', () => {
    const out = computeSleeve(capInput);
    // 2 in × 5 sts/in = 10 sts, rounded to even
    expect(out.capTopStitches).toBe(10);
  });

  it('reports total sleeve length including cap', () => {
    const out = computeSleeve(capInput);
    // cuffToUnderarmLength (18) + 0.8 × armholeDepth (6.4) = 24.4
    expect(out.finishedTotalLength).toBeCloseTo(24.5, 1);
  });

  it('omits cap steps when no cap is configured', () => {
    const out = computeSleeve({ ...capInput, cap: undefined });
    expect(out.capTopStitches).toBeNull();
    expect(out.steps.some((s) => s.label.startsWith('Cap'))).toBe(false);
    const underarm = out.steps.find((s) => s.label === 'Underarm')!;
    expect(underarm.instruction).toContain('holder');
  });
});

describe('computeHat', () => {
  const baseInput: HatInput = {
    gauge: STANDARD_GAUGE,
    headCircumference: 22,
    negativeEaseAtBrim: 1.5,
    totalHeight: 9,
    brimDepth: 2,
    crownHeight: 2.5,
  };

  it('casts on the right number of stitches with negative ease', () => {
    const out = computeHat(baseInput);
    // finishedCirc = 22 - 1.5 = 20.5 in × 5 sts/in = 102.5 → Math.round = 103
    // then stepped up to even = 104
    expect(out.castOnStitches).toBe(104);
  });

  it('produces brim / body / crown / close steps in order', () => {
    const out = computeHat(baseInput);
    expect(out.steps.map((s) => s.label)).toEqual([
      'Brim',
      'Body',
      'Crown decreases',
      'Close crown',
    ]);
  });

  it('splits rows correctly across sections', () => {
    const out = computeHat(baseInput);
    // totalRows at 7 rows/in × 9 in = 63; brim 14, crown 18 (rounded), body = 31
    expect(out.brimRows).toBe(14);
    expect(out.crownRows).toBe(18);
    expect(out.bodyRows).toBe(31);
  });

  it('ends the crown at the canonical 8-stitch closing count', () => {
    const out = computeHat(baseInput);
    expect(out.crownEndStitches).toBe(8);
    const close = out.steps.find((s) => s.label === 'Close crown')!;
    expect(close.instruction).toMatch(/thread through/i);
  });

  it('reports finished dimensions rounded to a quarter inch', () => {
    const out = computeHat(baseInput);
    expect(out.finishedCircumference).toBe(20.5);
    expect(out.finishedHeight).toBe(9);
  });

  it('degrades gracefully when head circumference is barely over ease', () => {
    const out = computeHat({ ...baseInput, headCircumference: 2, negativeEaseAtBrim: 1 });
    // finishedCirc = 1 in → very small but positive, doesn't throw
    expect(out.castOnStitches).toBeGreaterThan(0);
  });
});

describe('computeScarf', () => {
  const baseInput: ScarfInput = {
    gauge: STANDARD_GAUGE,
    width: 8,
    length: 60,
  };

  it('casts on width × gauge stitches rounded to even', () => {
    const out = computeScarf(baseInput);
    // 8 in × 5 sts/in = 40 sts
    expect(out.castOnStitches).toBe(40);
  });

  it('computes total rows from length × gauge', () => {
    const out = computeScarf(baseInput);
    // 60 in × 7 rows/in = 420 rows
    expect(out.totalRows).toBe(420);
  });

  it('produces cast-on / body / bind-off steps', () => {
    const out = computeScarf(baseInput);
    const labels = out.steps.map((s) => s.label);
    expect(labels).toEqual(['Cast on', 'Body', 'Bind off']);
  });

  it('adds fringe instructions when requested', () => {
    const out = computeScarf({ ...baseInput, fringeLength: 4 });
    const fringe = out.steps.find((s) => s.label === 'Fringe');
    expect(fringe).toBeTruthy();
    expect(fringe!.instruction).toMatch(/crochet hook/i);
  });

  it('skips fringe when length is 0 or omitted', () => {
    expect(computeScarf(baseInput).steps.some((s) => s.label === 'Fringe')).toBe(false);
    expect(computeScarf({ ...baseInput, fringeLength: 0 }).steps.some((s) => s.label === 'Fringe')).toBe(false);
  });
});

describe('computeBlanket', () => {
  const baseInput: BlanketInput = {
    gauge: STANDARD_GAUGE,
    width: 40,
    length: 50,
    borderDepth: 1.5,
  };

  it('casts on width × gauge stitches rounded to even', () => {
    const out = computeBlanket(baseInput);
    // 40 in × 5 sts/in = 200 sts
    expect(out.castOnStitches).toBe(200);
  });

  it('reserves border stitches per side based on border depth', () => {
    const out = computeBlanket(baseInput);
    // 1.5 in × 5 sts/in = 7.5 → rounded = 8
    expect(out.borderStitchesPerSide).toBe(8);
  });

  it('emits cast-on, bottom border, body, top border, bind-off', () => {
    const out = computeBlanket(baseInput);
    const labels = out.steps.map((s) => s.label);
    expect(labels).toEqual([
      'Cast on',
      'Bottom border',
      'Body with side borders',
      'Top border',
      'Bind off',
    ]);
  });

  it('body instruction references all three pattern stretches', () => {
    const out = computeBlanket(baseInput);
    const body = out.steps.find((s) => s.label === 'Body with side borders')!;
    expect(body.instruction).toMatch(/border pattern.*main pattern.*border pattern/);
  });

  it('skips borders entirely when borderDepth is 0', () => {
    const out = computeBlanket({ ...baseInput, borderDepth: 0 });
    const labels = out.steps.map((s) => s.label);
    expect(labels).toEqual(['Cast on', 'Body', 'Bind off']);
    expect(out.borderStitchesPerSide).toBe(0);
  });
});

describe('computeShawl', () => {
  const baseInput: ShawlInput = {
    gauge: STANDARD_GAUGE,
    wingspan: 60,
    initialCastOn: 7,
  };

  it('ends at wingspan × gauge stitches', () => {
    const out = computeShawl(baseInput);
    // 60 × 5 = 300, even rounded = 300
    expect(out.finalStitches).toBe(300);
  });

  it('totalRows is roughly (finalStitches - castOn) / 2', () => {
    const out = computeShawl(baseInput);
    // (300 - 7) / 2 = 146.5 → rounds to 147 or 146
    expect(out.totalRows).toBeGreaterThanOrEqual(146);
    expect(out.totalRows).toBeLessThanOrEqual(147);
  });

  it('emits garter tab, increases, border, bind-off steps', () => {
    const out = computeShawl(baseInput);
    const labels = out.steps.map((s) => s.label);
    expect(labels).toEqual([
      'Garter-tab cast-on',
      'Triangle increases',
      'Border (optional)',
      'Bind off',
    ]);
  });

  it('enforces minimum cast-on of 3', () => {
    const out = computeShawl({ ...baseInput, initialCastOn: 1 });
    expect(out.castOnStitches).toBeGreaterThanOrEqual(3);
  });

  it('derives depth from row count and gauge', () => {
    const out = computeShawl(baseInput);
    // totalRows ~ 147 ÷ (28/4) = 21 in
    expect(out.finishedDepth).toBeGreaterThan(18);
    expect(out.finishedDepth).toBeLessThan(24);
  });
});

describe('computeMittens', () => {
  const baseInput: MittenInput = {
    gauge: STANDARD_GAUGE,
    handCircumference: 8,
    negativeEaseAtCuff: 0.5,
    thumbCircumference: 3,
    cuffDepth: 2,
    cuffToThumbLength: 1,
    thumbGussetLength: 1.5,
    thumbToTipLength: 3,
    thumbLength: 2,
  };

  it('casts on hand × gauge with a touch of negative ease', () => {
    const out = computeMittens(baseInput);
    // 7.5 × 5 = 37.5 → rounded to even = 38
    expect(out.castOnStitches).toBe(38);
  });

  it('computes thumb width from thumb circumference', () => {
    const out = computeMittens(baseInput);
    // 3 × 5 = 15 → rounded to even = 16
    expect(out.thumbStitches).toBe(16);
  });

  it('has cuff, hand-to-thumb, gusset, set-aside, hand-above, top-dec, thumb steps', () => {
    const out = computeMittens(baseInput);
    const labels = out.steps.map((s) => s.label);
    expect(labels).toContain('Cuff');
    expect(labels).toContain('Thumb gusset');
    expect(labels).toContain('Set aside thumb');
    expect(labels).toContain('Top decreases');
    expect(labels).toContain('Thumb');
  });
});

describe('computeSocks', () => {
  const baseInput: SockInput = {
    gauge: STANDARD_GAUGE,
    ankleCircumference: 8,
    negativeEaseAtCuff: 0.5,
    footCircumference: 9,
    cuffDepth: 1.5,
    legLength: 6,
    footLength: 8,
  };

  it('casts on a multiple of 4 for clean rib + heel split', () => {
    const out = computeSocks(baseInput);
    expect(out.castOnStitches % 4).toBe(0);
  });

  it('heel flap uses half the total stitches', () => {
    const out = computeSocks(baseInput);
    expect(out.heelFlapRows).toBe(out.castOnStitches / 2);
  });

  it('emits cuff, leg, heel flap, heel turn, gusset, foot, toe, graft steps', () => {
    const out = computeSocks(baseInput);
    const labels = out.steps.map((s) => s.label);
    expect(labels).toEqual([
      'Cuff',
      'Leg',
      'Heel flap',
      'Heel turn',
      'Gusset',
      'Foot',
      'Toe decreases',
      'Graft toe',
    ]);
  });

  it('gusset step describes pick-up and decrease back to foot stitches', () => {
    const out = computeSocks(baseInput);
    const gusset = out.steps.find((s) => s.label === 'Gusset')!;
    expect(gusset.instruction).toMatch(/pick up.*along each side/i);
    expect(gusset.endStitches).toBe(out.footStitches);
  });
});
