/**
 * Tests for patternService.
 *
 * Two layers:
 *  - Pure transform tests (`buildCanonicalFromSnapshot`) covering each of
 *    the 8 legacy itemTypes — these run without any DB mock and verify
 *    that every relevant `DesignerFormSnapshot` field flows into the
 *    correct section's `parameters` bag.
 *  - DB-touching tests (`importDesignerSnapshot`, `createPattern`,
 *    `updatePattern`, etc.) using the same mocked-knex pattern as
 *    `chartSymbolService.test.ts` and `projectSharingService.test.ts`.
 */

jest.mock('../../config/database', () => {
  const builder: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    clone: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockResolvedValue(1),
    returning: jest.fn(),
    first: jest.fn(),
    then: undefined,
  };
  const dbFn = jest.fn(() => builder);
  (dbFn as any).__builder = builder;
  return { default: dbFn, __esModule: true };
});

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

import {
  buildCanonicalFromBlogImport,
  buildCanonicalFromChartUpload,
  buildCanonicalFromSnapshot,
  createPattern,
  importDesignerSnapshot,
  normalizePatternSection,
  normalizePatternSections,
  type LegacyDesignerSnapshot,
} from '../patternService';
import db from '../../config/database';
import { ValidationError } from '../../utils/errorHandler';

const mockedDb = db as unknown as jest.Mock & {
  __builder: {
    first: jest.Mock;
    returning: jest.Mock;
    insert: jest.Mock;
    update: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    whereNull: jest.Mock;
  };
};

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseGauge: Partial<LegacyDesignerSnapshot> = {
  unit: 'in',
  craft: 'knit',
  gaugeStitches: 20,
  gaugeRows: 28,
  gaugeMeasurement: 4,
};

const sweaterSnapshot = (): LegacyDesignerSnapshot => ({
  ...baseGauge,
  itemType: 'sweater',
  chestCircumference: 40,
  easeAtChest: 4,
  totalLength: 24,
  hemDepth: 2,
  useWaistShaping: true,
  waistCircumference: 36,
  easeAtWaist: 2,
  waistHeightFromHem: 6,
  useArmhole: true,
  armholeDepth: 8,
  shoulderWidth: 5,
  panelType: 'front',
  necklineDepth: 3,
  neckOpeningWidth: 7,
  cuffCircumference: 9,
  easeAtCuff: 1,
  bicepCircumference: 14,
  easeAtBicep: 2,
  cuffToUnderarmLength: 18,
  cuffDepth: 2,
  colors: [{ id: 'c1', hex: '#ff0000', name: 'Red' }],
  patternTitle: 'Test Pullover',
  patternNotes: 'Block aggressively.',
});

// ---------------------------------------------------------------------------
// Pure transform — per itemType
// ---------------------------------------------------------------------------

describe('buildCanonicalFromSnapshot — gauge + craft + name', () => {
  it('preserves gauge units, stitches, rows, and measurement', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: { ...baseGauge, itemType: 'scarf' },
      userId: 'u1',
    });
    expect(built.gaugeProfile).toEqual({
      stitches: 20,
      rows: 28,
      measurement: 4,
      unit: 'in',
      blocked: null,
      toolSize: null,
      notes: null,
    });
  });

  it('falls back to a sensible default measurement when missing', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: { unit: 'cm', gaugeStitches: 22, gaugeRows: 30, itemType: 'hat' },
      userId: 'u1',
    });
    expect(built.gaugeProfile.unit).toBe('cm');
    expect(built.gaugeProfile.measurement).toBe(10);
  });

  it('defaults craft to knit when the snapshot omits it', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: { itemType: 'hat', headCircumference: 22 },
      userId: 'u1',
    });
    expect(built.craft).toBe('knit');
  });

  it('honors crochet craft when set', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: { itemType: 'scarf', craft: 'crochet', scarfWidth: 8 },
      userId: 'u1',
    });
    expect(built.craft).toBe('crochet');
  });

  it('always normalizes technique to standard for legacy imports', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: { itemType: 'shawl', shawlWingspan: 60 },
      userId: 'u1',
    });
    expect(built.technique).toBe('standard');
  });

  it('uses the explicit name when provided', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: { itemType: 'hat' },
      userId: 'u1',
      name: '  Cabled Beanie  ',
    });
    expect(built.name).toBe('Cabled Beanie');
  });

  it('falls back to patternTitle then to the itemType label', () => {
    const titled = buildCanonicalFromSnapshot({
      snapshot: { itemType: 'mittens', patternTitle: 'Winter Mitts' },
      userId: 'u1',
    });
    expect(titled.name).toBe('Winter Mitts');

    const generic = buildCanonicalFromSnapshot({
      snapshot: { itemType: 'mittens' },
      userId: 'u1',
    });
    expect(generic.name).toBe('Mittens');
  });

  it('always emits a single-size SizeSet with one active size', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: { itemType: 'scarf' },
      userId: 'u1',
    });
    expect(built.sizeSet.sizes).toHaveLength(1);
    expect(built.sizeSet.active).toBe(built.sizeSet.sizes[0].id);
  });

  it('maps colors to material entries with kind="yarn"', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: {
        itemType: 'blanket',
        colors: [
          { id: 'c1', hex: '#aabbcc', name: 'Sky' },
          { id: 'c2', hex: '#112233', name: 'Navy' },
        ],
      },
      userId: 'u1',
    });
    expect(built.materials).toHaveLength(2);
    expect(built.materials[0]).toMatchObject({
      id: 'c1',
      name: 'Sky',
      colorHex: '#aabbcc',
      kind: 'yarn',
    });
  });

  it('preserves patternNotes onto the canonical row', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: { itemType: 'hat', patternNotes: 'Wash gently.' },
      userId: 'u1',
    });
    expect(built.notes).toBe('Wash gently.');
  });
});

describe('buildCanonicalFromSnapshot — sweater', () => {
  it('emits two sections: body then sleeve', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: sweaterSnapshot(),
      userId: 'u1',
    });
    expect(built.sections).toHaveLength(2);
    expect(built.sections[0].kind).toBe('sweater-body');
    expect(built.sections[0].sortOrder).toBe(0);
    expect(built.sections[1].kind).toBe('sweater-sleeve');
    expect(built.sections[1].sortOrder).toBe(1);
  });

  it('flows every body field into body.parameters', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: sweaterSnapshot(),
      userId: 'u1',
    });
    const bodyParams = built.sections[0].parameters;
    expect(bodyParams).toMatchObject({
      chestCircumference: 40,
      easeAtChest: 4,
      totalLength: 24,
      hemDepth: 2,
      useWaistShaping: true,
      waistCircumference: 36,
      easeAtWaist: 2,
      waistHeightFromHem: 6,
      useArmhole: true,
      armholeDepth: 8,
      shoulderWidth: 5,
      panelType: 'front',
      necklineDepth: 3,
      neckOpeningWidth: 7,
    });
    // Sleeve-only fields don't leak into body.
    expect(bodyParams).not.toHaveProperty('cuffCircumference');
  });

  it('flows every sleeve field plus body armhole context into sleeve.parameters', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: sweaterSnapshot(),
      userId: 'u1',
    });
    const sleeveParams = built.sections[1].parameters;
    expect(sleeveParams).toMatchObject({
      cuffCircumference: 9,
      easeAtCuff: 1,
      bicepCircumference: 14,
      easeAtBicep: 2,
      cuffToUnderarmLength: 18,
      cuffDepth: 2,
      // Sleeve cap math depends on these — preserved on sleeve too.
      useArmhole: true,
      armholeDepth: 8,
    });
  });
});

describe('buildCanonicalFromSnapshot — hat', () => {
  it('emits a single hat section with the brim/crown fields', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: {
        ...baseGauge,
        itemType: 'hat',
        headCircumference: 22,
        negativeEaseAtBrim: 1,
        hatTotalHeight: 9,
        hatBrimDepth: 2,
        hatCrownHeight: 3,
      },
      userId: 'u1',
    });
    expect(built.sections).toHaveLength(1);
    expect(built.sections[0].kind).toBe('hat');
    expect(built.sections[0].parameters).toEqual({
      headCircumference: 22,
      negativeEaseAtBrim: 1,
      hatTotalHeight: 9,
      hatBrimDepth: 2,
      hatCrownHeight: 3,
    });
  });
});

describe('buildCanonicalFromSnapshot — scarf', () => {
  it('emits a single scarf section with width / length / fringe', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: {
        ...baseGauge,
        itemType: 'scarf',
        scarfWidth: 8,
        scarfLength: 60,
        scarfFringeLength: 4,
      },
      userId: 'u1',
    });
    expect(built.sections).toHaveLength(1);
    expect(built.sections[0].kind).toBe('scarf');
    expect(built.sections[0].parameters).toEqual({
      scarfWidth: 8,
      scarfLength: 60,
      scarfFringeLength: 4,
    });
  });
});

describe('buildCanonicalFromSnapshot — blanket', () => {
  it('emits a single blanket section with width / length / border', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: {
        ...baseGauge,
        itemType: 'blanket',
        blanketWidth: 40,
        blanketLength: 60,
        blanketBorderDepth: 2,
      },
      userId: 'u1',
    });
    expect(built.sections).toHaveLength(1);
    expect(built.sections[0].kind).toBe('blanket');
    expect(built.sections[0].parameters).toEqual({
      blanketWidth: 40,
      blanketLength: 60,
      blanketBorderDepth: 2,
    });
  });
});

describe('buildCanonicalFromSnapshot — shawl', () => {
  it('emits a single shawl section with wingspan + initial cast-on', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: {
        ...baseGauge,
        itemType: 'shawl',
        shawlWingspan: 60,
        shawlInitialCastOn: 5,
      },
      userId: 'u1',
    });
    expect(built.sections).toHaveLength(1);
    expect(built.sections[0].kind).toBe('shawl');
    expect(built.sections[0].parameters).toEqual({
      shawlWingspan: 60,
      shawlInitialCastOn: 5,
    });
  });
});

describe('buildCanonicalFromSnapshot — mittens', () => {
  it('emits a single mittens section with hand / thumb / cuff fields', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: {
        ...baseGauge,
        itemType: 'mittens',
        handCircumference: 8,
        negativeEaseAtMittenCuff: 0.5,
        thumbCircumference: 2.5,
        mittenCuffDepth: 2,
        cuffToThumbLength: 3,
        thumbGussetLength: 1.5,
        thumbToTipLength: 4,
        thumbLength: 2.5,
      },
      userId: 'u1',
    });
    expect(built.sections).toHaveLength(1);
    expect(built.sections[0].kind).toBe('mittens');
    expect(built.sections[0].parameters).toMatchObject({
      handCircumference: 8,
      negativeEaseAtMittenCuff: 0.5,
      thumbCircumference: 2.5,
      mittenCuffDepth: 2,
      cuffToThumbLength: 3,
      thumbGussetLength: 1.5,
      thumbToTipLength: 4,
      thumbLength: 2.5,
    });
  });
});

describe('buildCanonicalFromSnapshot — socks', () => {
  it('emits a single socks section with ankle / foot / leg fields', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: {
        ...baseGauge,
        itemType: 'socks',
        ankleCircumference: 8,
        negativeEaseAtSockCuff: 1,
        footCircumference: 9,
        sockCuffDepth: 2,
        legLength: 6,
        footLength: 9,
      },
      userId: 'u1',
    });
    expect(built.sections).toHaveLength(1);
    expect(built.sections[0].kind).toBe('socks');
    expect(built.sections[0].parameters).toEqual({
      ankleCircumference: 8,
      negativeEaseAtSockCuff: 1,
      footCircumference: 9,
      sockCuffDepth: 2,
      legLength: 6,
      footLength: 9,
    });
  });
});

describe('buildCanonicalFromSnapshot — custom', () => {
  it('emits one section per DraftSection in order, each carrying the cast-on', () => {
    const built = buildCanonicalFromSnapshot({
      snapshot: {
        ...baseGauge,
        itemType: 'custom',
        customDraft: {
          craftMode: 'machine',
          startingStitches: 120,
          sections: [
            {
              id: 'a',
              name: 'Ribbing',
              type: 'ribbing',
              rows: 12,
              changePerSide: 0,
              note: 'k1, p1',
            },
            {
              id: 'b',
              name: 'Body',
              type: 'straight',
              rows: 60,
              changePerSide: 0,
              note: '',
            },
            {
              id: 'c',
              name: 'Shaping',
              type: 'decrease',
              rows: 28,
              changePerSide: 8,
              note: 'Decrease evenly.',
            },
          ],
        },
      },
      userId: 'u1',
    });

    expect(built.sections).toHaveLength(3);
    expect(built.sections.map((s) => s.kind)).toEqual([
      'custom-draft-section',
      'custom-draft-section',
      'custom-draft-section',
    ]);
    expect(built.sections.map((s) => s.name)).toEqual(['Ribbing', 'Body', 'Shaping']);
    expect(built.sections.map((s) => s.sortOrder)).toEqual([0, 1, 2]);
    expect(built.sections[0].parameters).toMatchObject({
      startingStitches: 120,
      craftMode: 'machine',
      type: 'ribbing',
      rows: 12,
      changePerSide: 0,
      legacySectionId: 'a',
    });
    expect(built.sections[0].notes).toBe('k1, p1');
    expect(built.sections[1].notes).toBeNull();
    expect(built.sections[2].parameters).toMatchObject({
      type: 'decrease',
      rows: 28,
      changePerSide: 8,
    });
  });

  it('emits a single fallback section when customDraft is missing or empty', () => {
    const missing = buildCanonicalFromSnapshot({
      snapshot: { ...baseGauge, itemType: 'custom' },
      userId: 'u1',
    });
    expect(missing.sections).toHaveLength(1);
    expect(missing.sections[0].kind).toBe('custom-draft-section');
    expect(missing.sections[0].parameters).toMatchObject({
      startingStitches: 100,
      craftMode: 'hand',
      type: 'straight',
    });

    const empty = buildCanonicalFromSnapshot({
      snapshot: {
        ...baseGauge,
        itemType: 'custom',
        customDraft: { sections: [] },
      },
      userId: 'u1',
    });
    expect(empty.sections).toHaveLength(1);
  });
});

describe('buildCanonicalFromSnapshot — unknown itemType', () => {
  it('preserves the entire snapshot under one catch-all section', () => {
    const snap: LegacyDesignerSnapshot = {
      ...baseGauge,
      itemType: 'tunic',
      // Future fields the canonical model doesn't enumerate yet.
      tunicLength: 30,
    };
    const built = buildCanonicalFromSnapshot({ snapshot: snap, userId: 'u1' });
    expect(built.sections).toHaveLength(1);
    expect(built.sections[0].parameters).toMatchObject({
      tunicLength: 30,
      _legacyItemType: 'tunic',
    });
  });
});

// ---------------------------------------------------------------------------
// importDesignerSnapshot — DB layer
// ---------------------------------------------------------------------------

describe('importDesignerSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const insertedRow = {
    id: 'new-id',
    user_id: 'u1',
    source_pattern_id: null,
    source_project_id: 'proj-1',
    name: 'Hat',
    craft: 'knit',
    technique: 'standard',
    gauge_profile: '{}',
    size_set: '{"active":"x","sizes":[]}',
    sections: '[]',
    legend: '{}',
    materials: '[]',
    progress_state: '{}',
    notes: null,
    schema_version: 1,
    created_at: new Date('2026-04-27T00:00:00Z'),
    updated_at: new Date('2026-04-27T00:00:00Z'),
    deleted_at: null,
  };

  it('inserts a new canonical row when no twin exists', async () => {
    // findExistingTwin → null
    mockedDb.__builder.first.mockResolvedValueOnce(null);
    // insert(...).returning('*')
    mockedDb.__builder.returning.mockResolvedValueOnce([insertedRow]);

    const result = await importDesignerSnapshot({
      snapshot: { itemType: 'hat', headCircumference: 22 },
      userId: 'u1',
      sourceProjectId: 'proj-1',
    });

    expect(result.id).toBe('new-id');
    expect(mockedDb.__builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'u1',
        source_project_id: 'proj-1',
        source_pattern_id: null,
        craft: 'knit',
        technique: 'standard',
      }),
    );
  });

  it('skips the twin lookup entirely when no source link is provided', async () => {
    mockedDb.__builder.returning.mockResolvedValueOnce([insertedRow]);

    await importDesignerSnapshot({
      snapshot: { itemType: 'hat' },
      userId: 'u1',
    });

    // first() should NOT have been called for twin lookup since there is
    // no source_pattern_id or source_project_id to match on.
    expect(mockedDb.__builder.first).not.toHaveBeenCalled();
    expect(mockedDb.__builder.insert).toHaveBeenCalled();
  });

  it('updates the existing twin instead of inserting when one exists', async () => {
    // findExistingTwin → existing row
    mockedDb.__builder.first
      .mockResolvedValueOnce({ id: 'existing-id' })
      // updatePattern's pre-check
      .mockResolvedValueOnce({ id: 'existing-id', user_id: 'u1', deleted_at: null });
    mockedDb.__builder.returning.mockResolvedValueOnce([
      { ...insertedRow, id: 'existing-id' },
    ]);

    const result = await importDesignerSnapshot({
      snapshot: { itemType: 'hat', headCircumference: 22 },
      userId: 'u1',
      sourceProjectId: 'proj-1',
    });

    expect(result.id).toBe('existing-id');
    expect(mockedDb.__builder.update).toHaveBeenCalled();
    // Insert path must NOT have run.
    expect(mockedDb.__builder.insert).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createPattern validation
// ---------------------------------------------------------------------------

describe('createPattern', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an empty name', async () => {
    await expect(
      createPattern('u1', { name: '   ', craft: 'knit' }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects an invalid craft', async () => {
    await expect(
      createPattern('u1', { name: 'Test', craft: 'macrame' as any }),
    ).rejects.toThrow(ValidationError);
  });

  it('inserts with sensible defaults when only name + craft are provided', async () => {
    mockedDb.__builder.returning.mockResolvedValueOnce([
      {
        id: 'p1',
        user_id: 'u1',
        source_pattern_id: null,
        source_project_id: null,
        name: 'Bare',
        craft: 'knit',
        technique: 'standard',
        gauge_profile: '{}',
        size_set: '{"active":"x","sizes":[{"id":"x","label":"Default","measurements":{}}]}',
        sections: '[]',
        legend: '{"overrides":{}}',
        materials: '[]',
        progress_state: '{}',
        notes: null,
        schema_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      },
    ]);

    const created = await createPattern('u1', { name: 'Bare', craft: 'knit' });
    expect(created.name).toBe('Bare');
    expect(created.technique).toBe('standard');
    expect(created.sections).toEqual([]);
    expect(created.materials).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildCanonicalFromBlogImport — pure transform tests
// ---------------------------------------------------------------------------

describe('buildCanonicalFromBlogImport', () => {
  it('uses payload.name when provided', () => {
    const built = buildCanonicalFromBlogImport({
      name: '  Cabled Cardigan  ',
      category: 'cardigan',
    });
    expect(built.name).toBe('Cabled Cardigan');
  });

  it('falls back to "Imported Pattern" when name is empty', () => {
    expect(buildCanonicalFromBlogImport({}).name).toBe('Imported Pattern');
    expect(buildCanonicalFromBlogImport({ name: '   ' }).name).toBe(
      'Imported Pattern',
    );
  });

  it('defaults craft=knit + technique=standard (blog imports do not capture either)', () => {
    const built = buildCanonicalFromBlogImport({ name: 'Hat' });
    expect(built.craft).toBe('knit');
    expect(built.technique).toBe('standard');
  });

  it('builds a single catch-all section keyed off the blog category', () => {
    const built = buildCanonicalFromBlogImport({
      name: 'Pattern',
      category: 'sweater',
      description: 'A worsted-weight pullover.',
    });
    expect(built.sections).toHaveLength(1);
    expect(built.sections[0].kind).toBe('sweater-body');
    expect(built.sections[0].name).toBe('Sweater');
    expect(built.sections[0].notes).toBe('A worsted-weight pullover.');
    // Stash blog-specific bits under leading-underscore parameters so
    // the canonical model knows where the data came from.
    expect(built.sections[0].parameters._blogCategory).toBe('sweater');
  });

  it('falls back to custom-draft-section for unknown categories', () => {
    const built = buildCanonicalFromBlogImport({ name: 'X', category: 'wibble' });
    expect(built.sections[0].kind).toBe('custom-draft-section');
  });

  it('translates yarnRequirements into MaterialEntry rows', () => {
    const built = buildCanonicalFromBlogImport({
      name: 'X',
      yarnRequirements: [
        { weight: 'DK', yardage: 800 },
        { weight: 'fingering', yardage: 1200 },
      ],
    });
    expect(built.materials).toHaveLength(2);
    expect(built.materials[0].name).toBe('DK');
    expect(built.materials[0].yardageMin).toBe(800);
    expect(built.materials[0].yardageMax).toBe(800);
    expect(built.materials[0].kind).toBe('yarn');
  });

  it('uses a generic yarn label when weight is omitted', () => {
    const built = buildCanonicalFromBlogImport({
      name: 'X',
      yarnRequirements: [{ yardage: 500 }],
    });
    expect(built.materials[0].name).toBe('Yarn 1');
  });

  it('emits an empty materials array when yarnRequirements is missing', () => {
    expect(buildCanonicalFromBlogImport({ name: 'X' }).materials).toEqual([]);
  });

  it('builds a default 4-in gauge from payload.gauge', () => {
    const built = buildCanonicalFromBlogImport({
      name: 'X',
      gauge: { stitches: 20, rows: 28 },
    });
    expect(built.gaugeProfile).toMatchObject({
      stitches: 20,
      rows: 28,
      measurement: 4,
      unit: 'in',
    });
  });

  it('treats null/undefined gauge fields as zero', () => {
    const built = buildCanonicalFromBlogImport({ name: 'X' });
    expect(built.gaugeProfile.stitches).toBe(0);
    expect(built.gaugeProfile.rows).toBe(0);
  });

  it('preserves notes on the canonical pattern', () => {
    const built = buildCanonicalFromBlogImport({
      name: 'X',
      notes: 'CO 80, work hem.',
    });
    expect(built.notes).toBe('CO 80, work hem.');
  });
});

// ---------------------------------------------------------------------------
// buildCanonicalFromChartUpload — pure transform tests
// ---------------------------------------------------------------------------

describe('buildCanonicalFromChartUpload', () => {
  it('produces one custom-draft-section with chartPlacement.chartId', () => {
    const built = buildCanonicalFromChartUpload({
      chartId: 'chart-uuid-1',
      chartName: 'Lace Repeat',
    });
    expect(built.name).toBe('Lace Repeat');
    expect(built.sections).toHaveLength(1);
    expect(built.sections[0].kind).toBe('custom-draft-section');
    expect(built.sections[0].chartPlacement).toEqual({
      chartId: 'chart-uuid-1',
      repeatMode: 'tile',
      offset: { x: 0, y: 0 },
      layer: 0,
    });
  });

  it('falls back to "Chart-only pattern" when name is empty', () => {
    expect(
      buildCanonicalFromChartUpload({ chartId: 'c', chartName: '' }).name,
    ).toBe('Chart-only pattern');
    expect(
      buildCanonicalFromChartUpload({ chartId: 'c', chartName: null }).name,
    ).toBe('Chart-only pattern');
  });

  it('emits a zeroed gauge so downstream surfaces know to ask the user', () => {
    const built = buildCanonicalFromChartUpload({
      chartId: 'c',
      chartName: 'Cable Panel',
    });
    expect(built.gaugeProfile.stitches).toBe(0);
    expect(built.gaugeProfile.rows).toBe(0);
    // Default 4-in measurement so the value is structurally valid.
    expect(built.gaugeProfile.measurement).toBe(4);
    expect(built.gaugeProfile.unit).toBe('in');
  });

  it('emits an empty materials list and no legend overrides', () => {
    const built = buildCanonicalFromChartUpload({ chartId: 'c' });
    expect(built.materials).toEqual([]);
    expect(built.legend.overrides).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// normalizePatternSection — backend boundary safety
//
// Regression coverage for the PR #370 prod-smoke crash. The frontend
// `PatternSection` type required `parameters`, but the API would happily
// persist sections without one — Make Mode's `totalRowsFor` then crashed
// on `section.parameters._totalRows`. PR #371 patched the one reader; this
// closes the loop at the backend boundary so all readers are safe.
// ---------------------------------------------------------------------------

describe('normalizePatternSection', () => {
  it('fills parameters with {} when missing', () => {
    const out = normalizePatternSection({
      id: 's1',
      name: 'Body',
      kind: 'sweater-body',
      sortOrder: 0,
    });
    expect(out.parameters).toEqual({});
  });

  it('preserves a valid parameters object verbatim', () => {
    const out = normalizePatternSection({
      id: 's1',
      name: 'Body',
      kind: 'sweater-body',
      sortOrder: 0,
      parameters: { _totalRows: 120, foo: 'bar' },
    });
    expect(out.parameters).toEqual({ _totalRows: 120, foo: 'bar' });
  });

  it('rejects an array as parameters and falls back to {}', () => {
    // Defends against a writer that sent `parameters: []` thinking it was
    // an array of param entries.
    const out = normalizePatternSection({
      id: 's1',
      name: 'Body',
      kind: 'sweater-body',
      sortOrder: 0,
      parameters: ['oops'],
    });
    expect(out.parameters).toEqual({});
  });

  it('fills chartPlacement with null when missing', () => {
    const out = normalizePatternSection({
      id: 's1',
      name: 'Body',
      kind: 'sweater-body',
      sortOrder: 0,
    });
    expect(out.chartPlacement).toBeNull();
  });

  it('preserves a valid chartPlacement', () => {
    const out = normalizePatternSection({
      id: 's1',
      name: 'Body',
      kind: 'sweater-body',
      sortOrder: 0,
      chartPlacement: { chartId: 'c1', repeatMode: 'tile' },
    });
    expect(out.chartPlacement).toEqual({ chartId: 'c1', repeatMode: 'tile' });
  });

  it('fills notes with null when missing', () => {
    const out = normalizePatternSection({
      id: 's1',
      name: 'Body',
      kind: 'sweater-body',
      sortOrder: 0,
    });
    expect(out.notes).toBeNull();
  });

  it('mints an id when missing', () => {
    const out = normalizePatternSection({
      name: 'Body',
      kind: 'sweater-body',
      sortOrder: 0,
    });
    expect(typeof out.id).toBe('string');
    expect(out.id.length).toBeGreaterThan(0);
  });

  it('falls back to custom-draft-section when kind is missing or unknown', () => {
    const missing = normalizePatternSection({ id: 's1', name: 'X', sortOrder: 0 });
    expect(missing.kind).toBe('custom-draft-section');
    const garbage = normalizePatternSection({
      id: 's1',
      name: 'X',
      kind: 'wibble',
      sortOrder: 0,
    });
    expect(garbage.kind).toBe('custom-draft-section');
  });

  it('uses the fallback sortOrder when missing', () => {
    const out = normalizePatternSection({ id: 's1', name: 'X', kind: 'hat' }, 7);
    expect(out.sortOrder).toBe(7);
  });

  it('survives null / undefined / non-object input', () => {
    expect(normalizePatternSection(null).parameters).toEqual({});
    expect(normalizePatternSection(undefined).parameters).toEqual({});
    expect(normalizePatternSection('not-a-section').parameters).toEqual({});
  });
});

describe('normalizePatternSections', () => {
  it('returns [] for non-array input', () => {
    expect(normalizePatternSections(null)).toEqual([]);
    expect(normalizePatternSections(undefined)).toEqual([]);
    expect(normalizePatternSections('garbage')).toEqual([]);
  });

  it('normalizes each section and preserves order', () => {
    const out = normalizePatternSections([
      { id: 'a', name: 'A', kind: 'hat', sortOrder: 0 },
      // missing parameters + chartPlacement + notes
      { id: 'b', name: 'B', kind: 'scarf', sortOrder: 1 },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].parameters).toEqual({});
    expect(out[1].parameters).toEqual({});
    expect(out[1].chartPlacement).toBeNull();
    expect(out[1].notes).toBeNull();
    expect(out.map((s) => s.id)).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// CRUD normalization — sections with missing parameters survive a roundtrip
// ---------------------------------------------------------------------------

describe('createPattern — section.parameters normalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writes {} for a section that arrives without parameters', async () => {
    mockedDb.__builder.returning.mockResolvedValueOnce([
      {
        id: 'p1',
        user_id: 'u1',
        source_pattern_id: null,
        source_project_id: null,
        name: 'Sloppy Caller',
        craft: 'knit',
        technique: 'standard',
        gauge_profile: '{}',
        size_set: '{"active":"x","sizes":[{"id":"x","label":"Default","measurements":{}}]}',
        // The DB row reflects whatever insert sent; the test asserts on the
        // insert payload below instead of round-tripping through parseJsonb.
        sections:
          '[{"id":"s1","name":"Body","kind":"sweater-body","sortOrder":0,"parameters":{},"chartPlacement":null,"notes":null}]',
        legend: '{"overrides":{}}',
        materials: '[]',
        progress_state: '{}',
        notes: null,
        schema_version: 1,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      },
    ]);

    await createPattern('u1', {
      name: 'Sloppy Caller',
      craft: 'knit',
      // Intentionally omit `parameters` to simulate a writer that only set
      // the four required-by-PR-1 fields. PR #370 prod-smoke crash repro.
      sections: [
        {
          id: 's1',
          name: 'Body',
          kind: 'sweater-body',
          sortOrder: 0,
        } as any,
      ],
    });

    const insertArg = mockedDb.__builder.insert.mock.calls[0][0];
    const sentSections = JSON.parse(insertArg.sections as string);
    expect(sentSections).toHaveLength(1);
    expect(sentSections[0].parameters).toEqual({});
    expect(sentSections[0].chartPlacement).toBeNull();
    expect(sentSections[0].notes).toBeNull();
  });
});

describe('rowToPattern — read-side normalization for legacy rows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes a row that pre-dates the boundary fix and has sloppy sections', async () => {
    // Simulate a legacy row already on disk: sections JSON with no
    // parameters / chartPlacement / notes. Re-imports and old API writes
    // could have produced this shape before normalization landed.
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'p1',
      user_id: 'u1',
      source_pattern_id: null,
      source_project_id: null,
      name: 'Legacy',
      craft: 'knit',
      technique: 'standard',
      gauge_profile: '{}',
      size_set: '{"active":"x","sizes":[]}',
      sections:
        '[{"id":"sec","name":"Body","kind":"sweater-body","sortOrder":0}]',
      legend: '{"overrides":{}}',
      materials: '[]',
      progress_state: '{}',
      notes: null,
      schema_version: 1,
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
    });

    const { getPattern } = await import('../patternService');
    const result = await getPattern('p1', 'u1');
    expect(result).not.toBeNull();
    expect(result!.sections[0].parameters).toEqual({});
    expect(result!.sections[0].chartPlacement).toBeNull();
    expect(result!.sections[0].notes).toBeNull();
  });
});
