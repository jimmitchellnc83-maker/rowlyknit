/**
 * Wave 2 PR 1 — sourceFileService unit tests.
 *
 * Locks in the contract for the next PR's controller layer:
 *   - assertCropWithinUnitSquare matches the DB CHECK constraints
 *     exactly (so the controller can fail fast without round-tripping
 *     a 500 from Postgres)
 *   - createCrop refuses to write a crop whose source file isn't
 *     owned by the same user (defense in depth even though the
 *     controller will already have verified)
 *   - pinSourceFileToProjectPattern verifies BOTH the project AND the
 *     source file belong to the user before touching the join row
 *
 * The DB itself is mocked; we're testing the service's input
 * validation + ownership wiring, not Knex.
 */

const dbBuilders: any = {
  source_files: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn(() => ({
      returning: jest.fn().mockResolvedValue([
        {
          id: 'sf-1',
          user_id: 'u-1',
          craft: 'knit',
          kind: 'pattern_pdf',
          storage_filename: 'a'.repeat(32) + '.pdf',
          storage_subdir: 'patterns',
          original_filename: null,
          mime_type: null,
          size_bytes: null,
          page_count: null,
          page_dimensions: null,
          parse_status: 'pending',
          parse_error: null,
          created_at: new Date('2026-05-02T12:00:00Z'),
          updated_at: new Date('2026-05-02T12:00:00Z'),
          deleted_at: null,
        },
      ]),
    })),
    orderBy: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(1),
  },
  pattern_crops: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn(() => ({
      returning: jest.fn().mockResolvedValue([
        {
          id: 'crop-1',
          source_file_id: 'sf-1',
          user_id: 'u-1',
          pattern_id: null,
          pattern_section_id: null,
          page_number: 1,
          crop_x: 0.1,
          crop_y: 0.1,
          crop_width: 0.5,
          crop_height: 0.5,
          label: null,
          chart_id: null,
          metadata: '{}',
          created_at: new Date('2026-05-02T12:00:00Z'),
          updated_at: new Date('2026-05-02T12:00:00Z'),
          deleted_at: null,
        },
      ]),
    })),
    orderBy: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(1),
  },
  projects: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
  },
  project_patterns: {
    where: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(1),
  },
};

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    return dbBuilders[table] ?? {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    };
  });
  return { default: dbFn, __esModule: true };
});

import {
  assertCropWithinUnitSquare,
  createCrop,
  createSourceFile,
  pinSourceFileToProjectPattern,
} from '../sourceFileService';
import { ValidationError } from '../../utils/errorHandler';

describe('assertCropWithinUnitSquare', () => {
  it('accepts a sane in-bounds crop', () => {
    expect(() =>
      assertCropWithinUnitSquare({
        pageNumber: 1,
        cropX: 0.1,
        cropY: 0.2,
        cropWidth: 0.4,
        cropHeight: 0.5,
      })
    ).not.toThrow();
  });

  it('accepts a crop that exactly fills the unit square', () => {
    expect(() =>
      assertCropWithinUnitSquare({
        pageNumber: 5,
        cropX: 0,
        cropY: 0,
        cropWidth: 1,
        cropHeight: 1,
      })
    ).not.toThrow();
  });

  it('rejects a non-integer page number', () => {
    expect(() =>
      assertCropWithinUnitSquare({
        pageNumber: 1.5,
        cropX: 0,
        cropY: 0,
        cropWidth: 0.5,
        cropHeight: 0.5,
      })
    ).toThrow(ValidationError);
  });

  it('rejects page number < 1', () => {
    expect(() =>
      assertCropWithinUnitSquare({
        pageNumber: 0,
        cropX: 0,
        cropY: 0,
        cropWidth: 0.5,
        cropHeight: 0.5,
      })
    ).toThrow(ValidationError);
  });

  it('rejects negative crop coords', () => {
    expect(() =>
      assertCropWithinUnitSquare({
        pageNumber: 1,
        cropX: -0.1,
        cropY: 0,
        cropWidth: 0.5,
        cropHeight: 0.5,
      })
    ).toThrow(ValidationError);
  });

  it('rejects zero-width or zero-height crops', () => {
    expect(() =>
      assertCropWithinUnitSquare({
        pageNumber: 1,
        cropX: 0,
        cropY: 0,
        cropWidth: 0,
        cropHeight: 0.5,
      })
    ).toThrow(ValidationError);
    expect(() =>
      assertCropWithinUnitSquare({
        pageNumber: 1,
        cropX: 0,
        cropY: 0,
        cropWidth: 0.5,
        cropHeight: 0,
      })
    ).toThrow(ValidationError);
  });

  it('rejects crops that escape the unit square', () => {
    expect(() =>
      assertCropWithinUnitSquare({
        pageNumber: 1,
        cropX: 0.7,
        cropY: 0,
        cropWidth: 0.5, // 0.7 + 0.5 = 1.2
        cropHeight: 0.5,
      })
    ).toThrow(ValidationError);
  });

  it('rejects NaN coords', () => {
    expect(() =>
      assertCropWithinUnitSquare({
        pageNumber: 1,
        cropX: NaN,
        cropY: 0,
        cropWidth: 0.5,
        cropHeight: 0.5,
      })
    ).toThrow(ValidationError);
  });
});

describe('createSourceFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns a camelCase SourceFile and never writes a craft other than the input', async () => {
    const sf = await createSourceFile({
      userId: 'u-1',
      craft: 'crochet',
      kind: 'pattern_pdf',
      storageFilename: 'a'.repeat(32) + '.pdf',
    });
    expect(sf.craft).toBe('knit'); // mocked return uses 'knit'; we still verify shape
    expect(sf.storageSubdir).toBe('patterns');
    // The insert call should have carried the input craft, not a default.
    const insertCall = dbBuilders.source_files.insert.mock.calls[0][0];
    expect(insertCall.craft).toBe('crochet');
  });
});

describe('createCrop ownership gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws when the source file is owned by another user', async () => {
    dbBuilders.source_files.first.mockResolvedValueOnce(null);
    await expect(
      createCrop({
        sourceFileId: 'sf-foreign',
        userId: 'u-attacker',
        pageNumber: 1,
        cropX: 0,
        cropY: 0,
        cropWidth: 0.5,
        cropHeight: 0.5,
      })
    ).rejects.toThrow(ValidationError);
    expect(dbBuilders.pattern_crops.insert).not.toHaveBeenCalled();
  });

  it('inserts when the source file is owned and the geometry is valid', async () => {
    dbBuilders.source_files.first.mockResolvedValueOnce({ id: 'sf-1' });
    const crop = await createCrop({
      sourceFileId: 'sf-1',
      userId: 'u-1',
      pageNumber: 1,
      cropX: 0.1,
      cropY: 0.1,
      cropWidth: 0.5,
      cropHeight: 0.5,
    });
    expect(crop.id).toBe('crop-1');
    expect(dbBuilders.pattern_crops.insert).toHaveBeenCalled();
  });

  it('throws on out-of-bounds geometry without touching the DB', async () => {
    await expect(
      createCrop({
        sourceFileId: 'sf-1',
        userId: 'u-1',
        pageNumber: 1,
        cropX: 0.5,
        cropY: 0.5,
        cropWidth: 0.6, // 0.5 + 0.6 > 1
        cropHeight: 0.5,
      })
    ).rejects.toThrow(ValidationError);
    expect(dbBuilders.source_files.first).not.toHaveBeenCalled();
    expect(dbBuilders.pattern_crops.insert).not.toHaveBeenCalled();
  });
});

describe('pinSourceFileToProjectPattern', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses when the project does not belong to the user', async () => {
    dbBuilders.projects.first.mockResolvedValueOnce(null);
    const ok = await pinSourceFileToProjectPattern({
      projectId: 'p-foreign',
      patternId: 'pat-1',
      sourceFileId: 'sf-1',
      userId: 'u-attacker',
    });
    expect(ok).toBe(false);
    expect(dbBuilders.project_patterns.update).not.toHaveBeenCalled();
  });

  it('refuses when the source file does not belong to the user', async () => {
    dbBuilders.projects.first.mockResolvedValueOnce({ id: 'p-1' });
    dbBuilders.source_files.first.mockResolvedValueOnce(null);
    const ok = await pinSourceFileToProjectPattern({
      projectId: 'p-1',
      patternId: 'pat-1',
      sourceFileId: 'sf-foreign',
      userId: 'u-1',
    });
    expect(ok).toBe(false);
    expect(dbBuilders.project_patterns.update).not.toHaveBeenCalled();
  });

  it('allows clearing the pin (sourceFileId=null) without checking the source file', async () => {
    dbBuilders.projects.first.mockResolvedValueOnce({ id: 'p-1' });
    const ok = await pinSourceFileToProjectPattern({
      projectId: 'p-1',
      patternId: 'pat-1',
      sourceFileId: null,
      userId: 'u-1',
    });
    expect(ok).toBe(true);
    expect(dbBuilders.source_files.first).not.toHaveBeenCalled();
    expect(dbBuilders.project_patterns.update).toHaveBeenCalledWith({
      source_file_id: null,
    });
  });

  it('updates when both ownership checks pass', async () => {
    dbBuilders.projects.first.mockResolvedValueOnce({ id: 'p-1' });
    dbBuilders.source_files.first.mockResolvedValueOnce({ id: 'sf-1' });
    const ok = await pinSourceFileToProjectPattern({
      projectId: 'p-1',
      patternId: 'pat-1',
      sourceFileId: 'sf-1',
      userId: 'u-1',
    });
    expect(ok).toBe(true);
    expect(dbBuilders.project_patterns.update).toHaveBeenCalledWith({
      source_file_id: 'sf-1',
    });
  });
});
