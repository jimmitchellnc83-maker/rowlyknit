/**
 * Wave 6 — joinLayoutService unit tests.
 *
 * Covers the load-bearing input gates (assertValidRegions, payload caps)
 * and the ownership refusals on create/update/delete.
 */

const dbBuilders: any = {
  projects: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
  },
  join_layouts: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn(() => ({
      returning: jest.fn().mockResolvedValue([
        {
          id: 'lay-1',
          project_id: 'p-1',
          user_id: 'u-1',
          name: 'L',
          regions: '[]',
          created_at: new Date('2026-05-02T12:00:00Z'),
          updated_at: new Date('2026-05-02T12:00:00Z'),
          deleted_at: null,
        },
      ]),
    })),
    update: jest.fn().mockResolvedValue(0),
    orderBy: jest.fn().mockResolvedValue([]),
  },
  blank_pages: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn(() => ({
      returning: jest.fn().mockResolvedValue([
        {
          id: 'bp-1',
          project_id: 'p-1',
          user_id: 'u-1',
          name: null,
          craft: 'knit',
          width: 8.5,
          height: 11,
          aspect_kind: 'letter',
          strokes: '[]',
          created_at: new Date('2026-05-02T12:00:00Z'),
          updated_at: new Date('2026-05-02T12:00:00Z'),
          deleted_at: null,
        },
      ]),
    })),
    update: jest.fn().mockResolvedValue(0),
    orderBy: jest.fn().mockResolvedValue([]),
  },
};

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    return dbBuilders[table] ?? { where: jest.fn().mockReturnThis(), first: jest.fn() };
  });
  return { default: dbFn, __esModule: true };
});

import {
  assertValidRegions,
  createBlankPage,
  createJoinLayout,
  softDeleteBlankPage,
  softDeleteJoinLayout,
  updateBlankPage,
  updateJoinLayout,
} from '../joinLayoutService';
import { ValidationError } from '../../utils/errorHandler';

describe('assertValidRegions', () => {
  it('accepts a valid regions array', () => {
    expect(() =>
      assertValidRegions([
        { patternCropId: 'c-1', x: 0, y: 0, width: 0.5, height: 0.5 },
        { patternCropId: 'c-2', x: 0.5, y: 0, width: 0.5, height: 1 },
      ])
    ).not.toThrow();
  });

  it('rejects non-array', () => {
    expect(() => assertValidRegions('not array' as unknown)).toThrow(ValidationError);
  });

  it('rejects regions with non-string patternCropId', () => {
    expect(() =>
      assertValidRegions([{ patternCropId: 1, x: 0, y: 0, width: 0.5, height: 0.5 }])
    ).toThrow(ValidationError);
  });

  it('rejects regions with out-of-range coords', () => {
    expect(() =>
      assertValidRegions([{ patternCropId: 'c', x: 1.5, y: 0, width: 0.5, height: 0.5 }])
    ).toThrow(ValidationError);
    expect(() =>
      assertValidRegions([{ patternCropId: 'c', x: 0, y: -0.1, width: 0.5, height: 0.5 }])
    ).toThrow(ValidationError);
  });
});

describe('createJoinLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when project is foreign', async () => {
    dbBuilders.projects.first.mockResolvedValueOnce(null);
    const r = await createJoinLayout({
      projectId: 'p-foreign',
      userId: 'u-attacker',
      name: 'X',
      regions: [],
    });
    expect(r).toBeNull();
    expect(dbBuilders.join_layouts.insert).not.toHaveBeenCalled();
  });

  it('creates when project is owned', async () => {
    dbBuilders.projects.first.mockResolvedValueOnce({ id: 'p-1' });
    const r = await createJoinLayout({
      projectId: 'p-1',
      userId: 'u-1',
      name: 'L',
      regions: [],
    });
    expect(r?.id).toBe('lay-1');
  });

  it('rejects empty name', async () => {
    await expect(
      createJoinLayout({ projectId: 'p-1', userId: 'u-1', name: '', regions: [] })
    ).rejects.toThrow(ValidationError);
  });
});

describe('updateJoinLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when layout is foreign (update count 0)', async () => {
    dbBuilders.join_layouts.update.mockResolvedValueOnce(0);
    const r = await updateJoinLayout({
      layoutId: 'lay-foreign',
      userId: 'u-attacker',
      name: 'New',
    });
    expect(r).toBeNull();
  });
});

describe('softDeleteJoinLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false on foreign', async () => {
    dbBuilders.join_layouts.update.mockResolvedValueOnce(0);
    expect(await softDeleteJoinLayout('lay-foreign', 'u-attacker')).toBe(false);
  });
});

describe('createBlankPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects non-positive dimensions', async () => {
    await expect(
      createBlankPage({
        projectId: 'p-1',
        userId: 'u-1',
        craft: 'knit',
        width: 0,
        height: 11,
        aspectKind: 'letter',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('returns null when project is foreign', async () => {
    dbBuilders.projects.first.mockResolvedValueOnce(null);
    const r = await createBlankPage({
      projectId: 'p-foreign',
      userId: 'u-attacker',
      craft: 'knit',
      width: 8.5,
      height: 11,
      aspectKind: 'letter',
    });
    expect(r).toBeNull();
  });

  it('creates when project is owned, defaulting craft to knit', async () => {
    dbBuilders.projects.first.mockResolvedValueOnce({ id: 'p-1' });
    const r = await createBlankPage({
      projectId: 'p-1',
      userId: 'u-1',
      craft: 'crochet',
      width: 8.5,
      height: 11,
      aspectKind: 'letter',
    });
    expect(r?.id).toBe('bp-1');
    const insertArg = dbBuilders.blank_pages.insert.mock.calls[0][0];
    expect(insertArg.craft).toBe('crochet');
  });
});

describe('updateBlankPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects strokes payload above 5 MB cap', async () => {
    const huge = Array.from({ length: 50000 }).map(() => ({
      points: Array.from({ length: 100 }).map(() => ({ x: 0.5, y: 0.5 })),
    }));
    await expect(
      updateBlankPage({
        pageId: 'bp-1',
        userId: 'u-1',
        strokes: huge,
      })
    ).rejects.toThrow(/5 MB/);
  });

  it('returns null when blank page is foreign', async () => {
    dbBuilders.blank_pages.update.mockResolvedValueOnce(0);
    const r = await updateBlankPage({
      pageId: 'bp-foreign',
      userId: 'u-attacker',
      name: 'X',
    });
    expect(r).toBeNull();
  });
});

describe('softDeleteBlankPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false on foreign', async () => {
    dbBuilders.blank_pages.update.mockResolvedValueOnce(0);
    expect(await softDeleteBlankPage('bp-foreign', 'u-attacker')).toBe(false);
  });
});
