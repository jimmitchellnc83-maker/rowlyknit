/**
 * Unit tests for feasibilityService.
 *
 * The module-level database import in '../config/database' triggers a
 * `SELECT 1` connection test on load, so we mock it here to keep these tests
 * DB-free. Only the DB-driven orchestrator (`getFeasibility`) actually uses
 * the mocked db — all other functions are pure.
 */

jest.mock('../../config/database', () => ({ default: jest.fn(), __esModule: true }));
jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

import {
  parseYarnRequirements,
  parseNeedleSizes,
  scoreYarnCandidate,
  matchYarn,
  matchTools,
  buildShoppingList,
  YarnStashRow,
  ToolRow,
  YarnRequirementResult,
  ToolRequirementResult,
} from '../feasibilityService';

// ---------------------------------------------------------------------------
// parseYarnRequirements
// ---------------------------------------------------------------------------

describe('parseYarnRequirements', () => {
  it('extracts yardage, weight, and fiber from a typical string', () => {
    const r = parseYarnRequirements('800 yards worsted weight wool');
    expect(r.totalYardage).toBe(800);
    expect(r.weightNumber).toBe(4);
    expect(r.weightName).toBe('Medium');
    expect(r.fiberHints).toContain('wool');
  });

  it('handles thousands separators', () => {
    const r = parseYarnRequirements('1,200 yds DK cotton');
    expect(r.totalYardage).toBe(1200);
    expect(r.weightNumber).toBe(3);
    expect(r.fiberHints).toContain('cotton');
  });

  it('converts meters to yards', () => {
    const r = parseYarnRequirements('500 meters fingering');
    // 500 * 1.09361 = 546.8 → 547
    expect(r.totalYardage).toBe(547);
    expect(r.weightNumber).toBe(1);
  });

  it('extracts skein count', () => {
    const r = parseYarnRequirements('3 skeins of DK cotton');
    expect(r.skeinCount).toBe(3);
    expect(r.weightNumber).toBe(3);
  });

  it('uses estimated_yardage as authoritative when present', () => {
    const r = parseYarnRequirements('about 800 yds worsted', 1000);
    expect(r.totalYardage).toBe(1000);
  });

  it('prefers "super fine" over "fine" (longest alias wins)', () => {
    const r = parseYarnRequirements('super fine sock yarn');
    expect(r.weightNumber).toBe(1);
    expect(r.weightName).toBe('Super Fine');
  });

  it('returns empty hints for blank input', () => {
    const r = parseYarnRequirements('');
    expect(r.totalYardage).toBeNull();
    expect(r.weightNumber).toBeNull();
    expect(r.fiberHints).toEqual([]);
  });

  it('does not mistake "mm" for meters', () => {
    // "needles in 5mm" should NOT yield a yardage in meters
    const r = parseYarnRequirements('needles in 5mm, lace weight');
    expect(r.totalYardage).toBeNull();
    expect(r.weightNumber).toBe(0);
  });

  it('combines multiple fiber hints into a set', () => {
    const r = parseYarnRequirements('worsted wool-acrylic blend, 400 yards');
    expect(r.fiberHints.sort()).toEqual(['acrylic', 'wool']);
  });
});

// ---------------------------------------------------------------------------
// parseNeedleSizes
// ---------------------------------------------------------------------------

describe('parseNeedleSizes', () => {
  it('parses direct mm values', () => {
    const r = parseNeedleSizes('4.5mm');
    expect(r.sizesMm).toEqual([4.5]);
  });

  it('parses US numeric sizes via conversion table', () => {
    const r = parseNeedleSizes('US 7');
    expect(r.sizesMm).toEqual([4.5]);
  });

  it('parses US 10.5 correctly', () => {
    const r = parseNeedleSizes('US 10.5');
    expect(r.sizesMm).toEqual([6.5]);
  });

  it('parses US 000 as smallest size', () => {
    const r = parseNeedleSizes('US 000');
    expect(r.sizesMm).toEqual([1.0]);
  });

  it('dedupes when US label and mm value coincide', () => {
    const r = parseNeedleSizes('US 7 (4.5mm)');
    expect(r.sizesMm).toEqual([4.5]);
  });

  it('returns multiple sizes sorted ascending', () => {
    const r = parseNeedleSizes('US 6, US 8');
    expect(r.sizesMm).toEqual([4.0, 5.0]);
  });

  it('returns empty list for blank or unrecognized input', () => {
    expect(parseNeedleSizes('').sizesMm).toEqual([]);
    expect(parseNeedleSizes('some random text').sizesMm).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// scoreYarnCandidate
// ---------------------------------------------------------------------------

function yarn(overrides: Partial<YarnStashRow> = {}): YarnStashRow {
  return {
    id: 'y1',
    name: 'Test Yarn',
    brand: 'TestBrand',
    weight: 'worsted',
    fiber_content: '100% wool',
    yards_remaining: 500,
    dye_lot: 'ABC',
    color: 'blue',
    is_stash: true,
    ...overrides,
  };
}

describe('scoreYarnCandidate', () => {
  it('gives full score for exact match', () => {
    const req = parseYarnRequirements('400 yards worsted wool');
    const c = scoreYarnCandidate(req, yarn());
    expect(c.level).toBe('green');
    expect(c.weightLevel).toBe('green');
    expect(c.yardageLevel).toBe('green');
    expect(c.fiberLevel).toBe('green');
    expect(c.score).toBe(100); // 60 + 30 + 10
  });

  it('yellow when weight is one step off', () => {
    const req = parseYarnRequirements('400 yards DK wool');
    const c = scoreYarnCandidate(req, yarn({ weight: 'worsted' }));
    expect(c.weightLevel).toBe('yellow');
    expect(c.level).toBe('yellow');
  });

  it('red when weight is two+ steps off', () => {
    const req = parseYarnRequirements('400 yards lace wool');
    const c = scoreYarnCandidate(req, yarn({ weight: 'worsted' }));
    expect(c.weightLevel).toBe('red');
    expect(c.level).toBe('red');
  });

  it('yellow when yardage is 80-99% of requirement', () => {
    const req = parseYarnRequirements('500 yards worsted wool');
    const c = scoreYarnCandidate(req, yarn({ yards_remaining: 450 }));
    expect(c.yardageLevel).toBe('yellow');
    expect(c.level).toBe('yellow');
  });

  it('red when yardage is well short (<50%)', () => {
    const req = parseYarnRequirements('500 yards worsted wool');
    const c = scoreYarnCandidate(req, yarn({ yards_remaining: 200 }));
    expect(c.yardageLevel).toBe('red');
    expect(c.level).toBe('red');
  });

  it('treats unknown dimensions as neutral, not penalized', () => {
    const req = parseYarnRequirements('worsted wool'); // no yardage
    const c = scoreYarnCandidate(req, yarn({ yards_remaining: null }));
    expect(c.yardageLevel).toBe('unknown');
    expect(c.level).toBe('green'); // weight + fiber are green
  });

  it('recognizes partial fiber overlap as yellow', () => {
    const req = parseYarnRequirements('400 yards worsted wool-silk');
    const c = scoreYarnCandidate(req, yarn({ fiber_content: '100% wool' }));
    expect(c.fiberLevel).toBe('yellow');
    expect(c.level).toBe('yellow');
  });

  it('recognizes shared fiber family as yellow', () => {
    const req = parseYarnRequirements('400 yards worsted alpaca');
    const c = scoreYarnCandidate(req, yarn({ fiber_content: '100% wool' }));
    expect(c.fiberLevel).toBe('yellow'); // both animal family
  });

  it('recognizes different fiber families as red', () => {
    const req = parseYarnRequirements('400 yards worsted cotton');
    const c = scoreYarnCandidate(req, yarn({ fiber_content: '100% acrylic' }));
    expect(c.fiberLevel).toBe('red');
    expect(c.level).toBe('red');
  });

  it('uses numeric weight stored directly ("4" → Medium)', () => {
    const req = parseYarnRequirements('400 yards worsted wool');
    const c = scoreYarnCandidate(req, yarn({ weight: '4' }));
    expect(c.weightLevel).toBe('green');
  });
});

// ---------------------------------------------------------------------------
// matchYarn
// ---------------------------------------------------------------------------

describe('matchYarn', () => {
  it('picks the highest-scoring candidate', () => {
    const req = parseYarnRequirements('400 yards worsted wool');
    const stash: YarnStashRow[] = [
      yarn({ id: 'bulky-cotton', weight: 'bulky', fiber_content: 'cotton', yards_remaining: 1000 }),
      yarn({ id: 'worsted-wool', weight: 'worsted', fiber_content: 'wool', yards_remaining: 500 }),
    ];
    const r = matchYarn(req, stash);
    expect(r.status).toBe('green');
    expect(r.bestCandidate?.yarnId).toBe('worsted-wool');
  });

  it('returns red when stash is empty', () => {
    const req = parseYarnRequirements('400 yards worsted wool');
    const r = matchYarn(req, []);
    expect(r.status).toBe('red');
    expect(r.bestCandidate).toBeNull();
  });

  it('excludes yarns marked is_stash=false', () => {
    const req = parseYarnRequirements('400 yards worsted wool');
    const stash: YarnStashRow[] = [
      yarn({ id: 'used-up', is_stash: false }),
    ];
    const r = matchYarn(req, stash);
    expect(r.status).toBe('red');
  });

  it('limits candidate list to top 5', () => {
    const req = parseYarnRequirements('400 yards worsted wool');
    const stash: YarnStashRow[] = Array.from({ length: 10 }, (_, i) =>
      yarn({ id: `y${i}`, yards_remaining: 400 + i }),
    );
    const r = matchYarn(req, stash);
    expect(r.candidates.length).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// matchTools
// ---------------------------------------------------------------------------

function tool(overrides: Partial<ToolRow> = {}): ToolRow {
  return {
    id: 't1',
    name: 'Test Needle',
    type: 'circular_needle',
    size: 'US 7',
    size_mm: 4.5,
    is_available: true,
    ...overrides,
  };
}

describe('matchTools', () => {
  it('returns green when an exact-size tool is available', () => {
    const result = matchTools([4.5], [tool()]);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('green');
    expect(result[0].matches[0].toolId).toBe('t1');
  });

  it('returns yellow when only a near-size tool is available', () => {
    const result = matchTools([4.5], [tool({ size_mm: 4.25 })]);
    expect(result[0].status).toBe('yellow');
  });

  it('returns red when no tool is close', () => {
    const result = matchTools([4.5], [tool({ size_mm: 6.0 })]);
    expect(result[0].status).toBe('red');
    expect(result[0].matches).toEqual([]);
  });

  it('returns red for each required size with no matches', () => {
    const result = matchTools([3.0, 8.0], []);
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('red');
    expect(result[1].status).toBe('red');
  });

  it('excludes unavailable tools', () => {
    const result = matchTools([4.5], [tool({ is_available: false })]);
    expect(result[0].status).toBe('red');
  });

  it('excludes tools with null size_mm', () => {
    const result = matchTools([4.5], [tool({ size_mm: null })]);
    expect(result[0].status).toBe('red');
  });
});

// ---------------------------------------------------------------------------
// buildShoppingList
// ---------------------------------------------------------------------------

describe('buildShoppingList', () => {
  it('adds a yarn entry when yarn status is red', () => {
    const req = parseYarnRequirements('800 yards worsted wool');
    const yarnResult: YarnRequirementResult = {
      status: 'red',
      requirement: req,
      bestCandidate: null,
      candidates: [],
      message: 'No match.',
    };
    const tools: ToolRequirementResult = { status: 'green', requirements: [], rawText: null };
    const list = buildShoppingList(yarnResult, tools);
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe('yarn');
    expect(list[0].description).toContain('medium');
    expect(list[0].description).toContain('wool');
    expect(list[0].description).toContain('800');
  });

  it('adds a yarn entry with "partial" reason when yarn status is yellow', () => {
    const req = parseYarnRequirements('800 yards worsted wool');
    const stash = [yarn({ name: 'Close Yarn', weight: 'dk', yards_remaining: 800 })];
    const yarnResult = matchYarn(req, stash);
    const tools: ToolRequirementResult = { status: 'green', requirements: [], rawText: null };
    const list = buildShoppingList(yarnResult, tools);
    expect(yarnResult.status).toBe('yellow');
    expect(list).toHaveLength(1);
    expect(list[0].reason).toContain('partial match');
  });

  it('does not add a yarn entry when yarn status is green', () => {
    const req = parseYarnRequirements('400 yards worsted wool');
    const stash = [yarn()];
    const yarnResult = matchYarn(req, stash);
    const tools: ToolRequirementResult = { status: 'green', requirements: [], rawText: null };
    const list = buildShoppingList(yarnResult, tools);
    expect(list.filter((i) => i.kind === 'yarn')).toHaveLength(0);
  });

  it('adds a tool entry for each red tool requirement', () => {
    const req = parseYarnRequirements('400 yards worsted wool');
    const yarnResult = matchYarn(req, [yarn()]);
    const tools: ToolRequirementResult = {
      status: 'red',
      rawText: 'US 8',
      requirements: [
        { sizeMm: 5.0, status: 'red', matches: [], message: 'none' },
        { sizeMm: 6.0, status: 'red', matches: [], message: 'none' },
      ],
    };
    const list = buildShoppingList(yarnResult, tools);
    const toolItems = list.filter((i) => i.kind === 'tool');
    expect(toolItems).toHaveLength(2);
    expect(toolItems[0].description).toContain('5mm');
    expect(toolItems[1].description).toContain('6mm');
  });

  it('omits yellow tools from the shopping list', () => {
    const req = parseYarnRequirements('400 yards worsted wool');
    const yarnResult = matchYarn(req, [yarn()]);
    const tools: ToolRequirementResult = {
      status: 'yellow',
      rawText: 'US 8',
      requirements: [{ sizeMm: 5.0, status: 'yellow', matches: [], message: 'close' }],
    };
    const list = buildShoppingList(yarnResult, tools);
    expect(list.filter((i) => i.kind === 'tool')).toHaveLength(0);
  });
});
