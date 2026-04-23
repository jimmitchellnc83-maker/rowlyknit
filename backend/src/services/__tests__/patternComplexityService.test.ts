/**
 * Unit tests for patternComplexityService.
 * All functions are pure; no DB mocking required.
 */

import {
  detectTechniques,
  countSections,
  maxRowNumber,
  countShapingInstructions,
  countSizes,
  estimateHoursAtReferenceGauge,
  calculatePatternComplexity,
} from '../patternComplexityService';

describe('detectTechniques', () => {
  it('returns empty when only plain stockinette', () => {
    expect(detectTechniques('Work in stockinette stitch for 40 rows.')).toEqual([]);
  });

  it('detects cables', () => {
    expect(detectTechniques('Row 5: C4F, knit to end.')).toContain('cables');
    expect(detectTechniques('Work cable panel per chart.')).toContain('cables');
  });

  it('detects lace via yarn-over and decrease abbreviations', () => {
    const t = detectTechniques('K2, yo, ssk, k2tog, repeat to end.');
    expect(t).toContain('lace');
  });

  it('detects colorwork variants', () => {
    expect(detectTechniques('fair isle yoke')).toContain('colorwork');
    expect(detectTechniques('stranded colorwork section')).toContain('colorwork');
    expect(detectTechniques('intarsia chart follows')).toContain('colorwork');
  });

  it('detects short rows', () => {
    expect(detectTechniques('work short rows w&t at marker')).toContain('short-rows');
  });

  it('detects steek', () => {
    expect(detectTechniques('Steek the armholes before blocking.')).toContain('steek');
  });

  it('dedupes across multiple matches', () => {
    const t = detectTechniques('cable, cable, C4F, C6B');
    expect(t.filter((x) => x === 'cables')).toHaveLength(1);
  });
});

describe('countSections', () => {
  it('returns 0 for no recognisable section headers', () => {
    expect(countSections('just a plain paragraph of knitting')).toBe(0);
  });

  it('counts standard sweater pieces', () => {
    const text = 'Back:\nwork 80 rows.\nFront:\nwork 72 rows.\nSleeves:\nwork 60 rows.\n';
    expect(countSections(text)).toBe(3);
  });

  it('dedupes repeated section headers', () => {
    expect(countSections('Front:\nwork.\nFront:\nmore.\n')).toBe(1);
  });
});

describe('maxRowNumber', () => {
  it('returns null when no row numbers', () => {
    expect(maxRowNumber('just instructions')).toBeNull();
  });

  it('returns the max row number mentioned', () => {
    expect(maxRowNumber('Row 1, Row 5, Row 120, Row 12.')).toBe(120);
  });

  it('handles "rows 50-60" plural form', () => {
    expect(maxRowNumber('Rows 50 to 60 are the yoke.')).toBe(60);
  });

  it('ignores absurdly large numbers', () => {
    expect(maxRowNumber('Row 99999 is nothing')).toBeNull();
  });
});

describe('countShapingInstructions', () => {
  it('counts decrease/increase/bind-off mentions', () => {
    const text = 'decrease 2 stitches. increase at edge. bind off next row. decrease again.';
    expect(countShapingInstructions(text)).toBe(4);
  });

  it('picks up raglan / yoke / set-in', () => {
    const n = countShapingInstructions('shape raglan, work yoke, set-in sleeve');
    expect(n).toBeGreaterThanOrEqual(3);
  });

  it('returns 0 for plain text', () => {
    expect(countShapingInstructions('work evenly in pattern')).toBe(0);
  });
});

describe('countSizes', () => {
  it('returns 0 for null/empty', () => {
    expect(countSizes(null)).toBe(0);
    expect(countSizes('')).toBe(0);
  });

  it('splits on commas', () => {
    expect(countSizes('S, M, L, XL')).toBe(4);
  });

  it('splits on slashes', () => {
    expect(countSizes('30/34/38/42')).toBe(4);
  });
});

describe('estimateHoursAtReferenceGauge', () => {
  it('returns null without row count', () => {
    expect(estimateHoursAtReferenceGauge(null, '20 sts / 4 in')).toBeNull();
  });

  it('returns null without gauge', () => {
    expect(estimateHoursAtReferenceGauge(200, null)).toBeNull();
  });

  it('estimates hours from row count + gauge + first size', () => {
    // 20 sts / 4" = 5 sts/in; 40" chest = 200 sts/row; 300 rows = 60000 sts
    // / 1500 sts/hr = 40 hours
    const h = estimateHoursAtReferenceGauge(300, '20 sts per 4 inches', '40"');
    expect(h).toBe(40);
  });
});

describe('calculatePatternComplexity', () => {
  it('returns null for empty inputs', () => {
    expect(calculatePatternComplexity({ notes: '', sizes_available: null })).toBeNull();
  });

  it('scores a plain scarf as Beginner (1)', () => {
    const r = calculatePatternComplexity({
      notes: 'Cast on 40. Work in stockinette until piece measures 60". Bind off.',
      sizes_available: null,
    });
    expect(r).not.toBeNull();
    expect(r!.level).toBe(1);
    expect(r!.label).toBe('Beginner');
  });

  it('scores a lace + cable + multi-size sweater high', () => {
    const notes = `
      Back:
      Row 1-120: work cable panel with C4F and C4B. ssk, yo, k2tog across row.
      decrease for armhole. decrease at raglan. shape neckline.
      Front:
      Rows 1-120: mirror back with fair isle colorwork yoke.
      Sleeves:
      Row 1-80: work short rows w&t at shoulder. bind off.
      Collar:
      cast on 100 for collar edging.
    `;
    const r = calculatePatternComplexity({
      notes,
      sizes_available: 'S, M, L, XL, 2X',
      gauge: '20 sts per 4 inches',
    });
    expect(r).not.toBeNull();
    expect(r!.level).toBeGreaterThanOrEqual(4);
    expect(r!.breakdown.techniques.length).toBeGreaterThanOrEqual(3);
    expect(r!.breakdown.sizeCount).toBe(5);
  });

  it('provides breakdown with all sub-scores', () => {
    const r = calculatePatternComplexity({
      notes: 'Row 50: decrease. Row 100: bind off.',
      sizes_available: 'S, M',
    });
    expect(r).not.toBeNull();
    expect(r!.breakdown.totalScore).toBeGreaterThanOrEqual(0);
    expect(r!.breakdown.totalScore).toBeLessThanOrEqual(10);
    expect(r!.breakdown.rowCount).toBe(100);
    expect(r!.breakdown.sizeCount).toBe(2);
  });
});
