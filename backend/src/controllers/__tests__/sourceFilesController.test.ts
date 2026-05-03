/**
 * Wave 2 PR 2 — controller tests for sourceFilesController.
 *
 * Controllers are plain async functions that throw NotFoundError /
 * ValidationError; routes wrap with asyncHandler. Tests assert via
 * `.rejects.toThrow(ErrorClass)`.
 */

const dbBuilders: any = {
  source_files: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn(() => ({
      returning: jest.fn(),
    })),
    update: jest.fn().mockResolvedValue(1),
  },
  pattern_crops: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn(() => ({
      returning: jest.fn(),
    })),
    update: jest.fn().mockResolvedValue(1),
    orderBy: jest.fn().mockResolvedValue([]),
  },
  patterns: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
  },
  projects: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
  },
  project_patterns: {
    where: jest.fn().mockReturnThis(),
    first: jest.fn(),
    update: jest.fn().mockResolvedValue(1),
  },
};

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    return (
      dbBuilders[table] ?? {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
      }
    );
  });
  return { default: dbFn, __esModule: true };
});

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

const streamSafeUploadMock = jest.fn(async (res: any) => {
  res.status(200);
  res.json({ streamed: true });
});

jest.mock('../../utils/uploadStorage', () => ({
  generateStorageFilename: () => 'a'.repeat(32) + '.pdf',
  streamSafeUpload: streamSafeUploadMock,
  uploadRoot: () => '/tmp/rowly-test-uploads',
}));

const writeFileMock = jest.fn().mockResolvedValue(undefined);
const mkdirMock = jest.fn().mockResolvedValue(undefined);
jest.mock('fs', () => ({
  promises: { writeFile: writeFileMock, mkdir: mkdirMock },
}));

jest.mock('pdf-lib', () => ({
  PDFDocument: {
    load: jest.fn(async () => ({
      getPageCount: () => 3,
      getPage: (i: number) => ({ getSize: () => ({ width: 612, height: 792 + i }) }),
    })),
  },
}));

import {
  createSourceFileCrop,
  deleteSourceFileCrop,
  listSourceFileCrops,
  pinSourceFile,
  streamSourceFileBytes,
  updateSourceFileCrop,
  uploadSourceFile,
} from '../sourceFilesController';
import { NotFoundError, ValidationError } from '../../utils/errorHandler';

function makeReq(args: {
  user?: { userId: string };
  params?: Record<string, string>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  file?: Partial<Express.Multer.File>;
}) {
  return {
    user: args.user ?? { userId: 'u-1' },
    params: args.params ?? {},
    body: args.body ?? {},
    query: args.query ?? {},
    file: args.file,
    socket: { setTimeout: jest.fn() },
  } as any;
}

function makeRes() {
  const res: any = { headersSent: false };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
}

const SF_ROW = {
  id: 'sf-1',
  user_id: 'u-1',
  craft: 'knit',
  kind: 'pattern_pdf',
  storage_filename: 'a'.repeat(32) + '.pdf',
  storage_subdir: 'patterns',
  original_filename: 'cabled-cardigan.pdf',
  mime_type: 'application/pdf',
  size_bytes: 1234,
  page_count: 3,
  page_dimensions: '[]',
  parse_status: 'pending',
  parse_error: null,
  created_at: new Date('2026-05-02T12:00:00Z'),
  updated_at: new Date('2026-05-02T12:00:00Z'),
  deleted_at: null,
};

const CROP_ROW = {
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
};

describe('uploadSourceFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    streamSafeUploadMock.mockClear();
    writeFileMock.mockClear();
    mkdirMock.mockClear();
    dbBuilders.source_files.insert.mockReturnValue({
      returning: jest.fn().mockResolvedValue([{ ...SF_ROW }]),
    });
  });

  it('rejects when no file is attached', async () => {
    await expect(
      uploadSourceFile(makeReq({ body: { craft: 'knit' } }), makeRes())
    ).rejects.toThrow(ValidationError);
  });

  it('writes the random-named file under patterns/ + parses PDF metadata', async () => {
    const res = makeRes();
    await uploadSourceFile(
      makeReq({
        body: { craft: 'knit', kind: 'pattern_pdf' },
        file: {
          buffer: Buffer.from('%PDF-1.4\nfake'),
          originalname: 'cardigan.pdf',
          mimetype: 'application/pdf',
          size: 1234,
        } as Express.Multer.File,
      }),
      res
    );
    expect(mkdirMock).toHaveBeenCalledWith(
      '/tmp/rowly-test-uploads/patterns',
      { recursive: true }
    );
    expect(writeFileMock).toHaveBeenCalledWith(
      `/tmp/rowly-test-uploads/patterns/${'a'.repeat(32)}.pdf`,
      expect.any(Buffer)
    );
    // Parse should fire updateSourceFileParseResult → DB update
    expect(dbBuilders.source_files.update).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('routes chart_image to the charts subdir', async () => {
    const res = makeRes();
    await uploadSourceFile(
      makeReq({
        body: { kind: 'chart_image', craft: 'crochet' },
        file: {
          buffer: Buffer.from('img'),
          originalname: 'chart.png',
          mimetype: 'image/png',
          size: 500,
        } as Express.Multer.File,
      }),
      res
    );
    expect(mkdirMock).toHaveBeenCalledWith(
      '/tmp/rowly-test-uploads/charts',
      { recursive: true }
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects when patternId in upload body belongs to another user', async () => {
    // Pattern lookup returns null → ownership fails → ValidationError
    // before any DB insert / disk write happens.
    dbBuilders.patterns.first.mockResolvedValueOnce(null);
    await expect(
      uploadSourceFile(
        makeReq({
          body: { craft: 'knit', kind: 'pattern_pdf', patternId: 'pat-foreign' },
          file: {
            buffer: Buffer.from('%PDF-1.4\nfake'),
            originalname: 'x.pdf',
            mimetype: 'application/pdf',
            size: 1234,
          } as Express.Multer.File,
        }),
        makeRes()
      )
    ).rejects.toThrow(ValidationError);
    expect(dbBuilders.source_files.insert).not.toHaveBeenCalled();
  });

  it('accepts when patternId in upload body is owned by the user', async () => {
    dbBuilders.patterns.first.mockResolvedValueOnce({ id: 'pat-1' });
    // Re-stub the source file insert (default may have been consumed by
    // an earlier test that used .toReturnValue once).
    dbBuilders.source_files.insert.mockReturnValueOnce({
      returning: jest.fn().mockResolvedValue([{ ...SF_ROW, intended_pattern_id: 'pat-1' }]),
    });
    const res = makeRes();
    await uploadSourceFile(
      makeReq({
        body: { craft: 'knit', kind: 'pattern_pdf', patternId: 'pat-1' },
        file: {
          buffer: Buffer.from('%PDF-1.4\nfake'),
          originalname: 'x.pdf',
          mimetype: 'application/pdf',
          size: 1234,
        } as Express.Multer.File,
      }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(201);
    const insertCall = dbBuilders.source_files.insert.mock.calls[0][0];
    expect(insertCall.intended_pattern_id).toBe('pat-1');
  });
});

describe('streamSourceFileBytes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    streamSafeUploadMock.mockClear();
  });

  it('throws NotFoundError when foreign user', async () => {
    dbBuilders.source_files.first.mockResolvedValueOnce(null);
    await expect(
      streamSourceFileBytes(makeReq({ params: { id: 'sf-foreign' } }), makeRes())
    ).rejects.toThrow(NotFoundError);
    expect(streamSafeUploadMock).not.toHaveBeenCalled();
  });

  it('streams when owned', async () => {
    dbBuilders.source_files.first.mockResolvedValueOnce(SF_ROW);
    await streamSourceFileBytes(
      makeReq({ params: { id: 'sf-1' } }),
      makeRes()
    );
    expect(streamSafeUploadMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        subdir: 'patterns',
        filename: 'a'.repeat(32) + '.pdf',
        mimeType: 'application/pdf',
      })
    );
  });
});

describe('createSourceFileCrop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dbBuilders.pattern_crops.insert.mockReturnValue({
      returning: jest.fn().mockResolvedValue([CROP_ROW]),
    });
  });

  it('creates a crop with valid geometry', async () => {
    dbBuilders.source_files.first.mockResolvedValueOnce(SF_ROW);
    const res = makeRes();
    await createSourceFileCrop(
      makeReq({
        params: { id: 'sf-1' },
        body: {
          pageNumber: 1,
          cropX: 0.1,
          cropY: 0.1,
          cropWidth: 0.5,
          cropHeight: 0.5,
        },
      }),
      res
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects out-of-bounds geometry without touching the DB', async () => {
    await expect(
      createSourceFileCrop(
        makeReq({
          params: { id: 'sf-1' },
          body: {
            pageNumber: 1,
            cropX: 0.7,
            cropY: 0,
            cropWidth: 0.5,
            cropHeight: 0.5,
          },
        }),
        makeRes()
      )
    ).rejects.toThrow(ValidationError);
    expect(dbBuilders.pattern_crops.insert).not.toHaveBeenCalled();
  });

  it('rejects when source file is foreign', async () => {
    dbBuilders.source_files.first.mockResolvedValueOnce(null);
    await expect(
      createSourceFileCrop(
        makeReq({
          params: { id: 'sf-foreign' },
          body: {
            pageNumber: 1,
            cropX: 0,
            cropY: 0,
            cropWidth: 0.5,
            cropHeight: 0.5,
          },
        }),
        makeRes()
      )
    ).rejects.toThrow(ValidationError);
  });

  it('rejects when supplied patternId belongs to another user', async () => {
    // Source file is owned, but the pattern is not.
    dbBuilders.source_files.first.mockResolvedValueOnce(SF_ROW);
    dbBuilders.patterns.first.mockResolvedValueOnce(null);
    await expect(
      createSourceFileCrop(
        makeReq({
          params: { id: 'sf-1' },
          body: {
            pageNumber: 1,
            cropX: 0,
            cropY: 0,
            cropWidth: 0.5,
            cropHeight: 0.5,
            patternId: 'pat-foreign',
          },
        }),
        makeRes()
      )
    ).rejects.toThrow(ValidationError);
    expect(dbBuilders.pattern_crops.insert).not.toHaveBeenCalled();
  });
});

describe('updateSourceFileCrop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws NotFoundError when the crop is not owned', async () => {
    dbBuilders.pattern_crops.first.mockResolvedValueOnce(null);
    await expect(
      updateSourceFileCrop(
        makeReq({
          params: { id: 'sf-1', cropId: 'crop-foreign' },
          body: { label: 'New' },
        }),
        makeRes()
      )
    ).rejects.toThrow(NotFoundError);
    expect(dbBuilders.pattern_crops.update).not.toHaveBeenCalled();
  });

  it('rejects partial geometry change that escapes the unit square', async () => {
    dbBuilders.pattern_crops.first
      .mockResolvedValueOnce(CROP_ROW)
      .mockResolvedValueOnce(CROP_ROW);
    await expect(
      updateSourceFileCrop(
        makeReq({
          params: { id: 'sf-1', cropId: 'crop-1' },
          body: { cropWidth: 0.95 },
        }),
        makeRes()
      )
    ).rejects.toThrow(ValidationError);
    expect(dbBuilders.pattern_crops.update).not.toHaveBeenCalled();
  });

  it('accepts a label-only update', async () => {
    dbBuilders.pattern_crops.first
      .mockResolvedValueOnce(CROP_ROW)
      .mockResolvedValueOnce({ ...CROP_ROW, label: 'Cable chart' });
    const res = makeRes();
    await updateSourceFileCrop(
      makeReq({
        params: { id: 'sf-1', cropId: 'crop-1' },
        body: { label: 'Cable chart' },
      }),
      res
    );
    expect(dbBuilders.pattern_crops.update).toHaveBeenCalledWith(
      expect.objectContaining({ label: 'Cable chart' })
    );
    expect(res.json).toHaveBeenCalled();
  });
});

describe('deleteSourceFileCrop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws NotFoundError when crop is foreign', async () => {
    dbBuilders.pattern_crops.update.mockResolvedValueOnce(0);
    await expect(
      deleteSourceFileCrop(
        makeReq({ params: { id: 'sf-1', cropId: 'crop-foreign' } }),
        makeRes()
      )
    ).rejects.toThrow(NotFoundError);
  });

  it('soft-deletes when owned', async () => {
    dbBuilders.pattern_crops.update.mockResolvedValueOnce(1);
    const res = makeRes();
    await deleteSourceFileCrop(
      makeReq({ params: { id: 'sf-1', cropId: 'crop-1' } }),
      res
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });
});

describe('listSourceFileCrops', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws NotFoundError when source file is foreign before listing', async () => {
    dbBuilders.source_files.first.mockResolvedValueOnce(null);
    await expect(
      listSourceFileCrops(
        makeReq({ params: { id: 'sf-foreign' } }),
        makeRes()
      )
    ).rejects.toThrow(NotFoundError);
    expect(dbBuilders.pattern_crops.orderBy).not.toHaveBeenCalled();
  });
});

describe('pinSourceFile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws ValidationError when sourceFileId is neither null nor string', async () => {
    await expect(
      pinSourceFile(
        makeReq({
          params: { projectId: 'p-1', patternId: 'pat-1' },
          body: { sourceFileId: 42 },
        }),
        makeRes()
      )
    ).rejects.toThrow(ValidationError);
  });

  it('forwards null to the service to clear the pin', async () => {
    dbBuilders.projects.first.mockResolvedValueOnce({ id: 'p-1' });
    dbBuilders.patterns.first.mockResolvedValueOnce({ id: 'pat-1' });
    dbBuilders.project_patterns.first.mockResolvedValueOnce({ id: 'pp-1' });
    dbBuilders.project_patterns.update.mockResolvedValueOnce(1);
    const res = makeRes();
    await pinSourceFile(
      makeReq({
        params: { projectId: 'p-1', patternId: 'pat-1' },
        body: { sourceFileId: null },
      }),
      res
    );
    expect(dbBuilders.project_patterns.update).toHaveBeenCalledWith({
      source_file_id: null,
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true })
    );
  });

  it('throws NotFoundError when pattern is foreign', async () => {
    dbBuilders.projects.first.mockResolvedValueOnce({ id: 'p-1' });
    dbBuilders.patterns.first.mockResolvedValueOnce(null);
    await expect(
      pinSourceFile(
        makeReq({
          params: { projectId: 'p-1', patternId: 'pat-foreign' },
          body: { sourceFileId: 'sf-1' },
        }),
        makeRes()
      )
    ).rejects.toThrow(NotFoundError);
    expect(dbBuilders.project_patterns.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when no project_patterns row exists for the pair', async () => {
    dbBuilders.projects.first.mockResolvedValueOnce({ id: 'p-1' });
    dbBuilders.patterns.first.mockResolvedValueOnce({ id: 'pat-1' });
    dbBuilders.source_files.first.mockResolvedValueOnce(SF_ROW);
    dbBuilders.project_patterns.first.mockResolvedValueOnce(null);
    await expect(
      pinSourceFile(
        makeReq({
          params: { projectId: 'p-1', patternId: 'pat-1' },
          body: { sourceFileId: 'sf-1' },
        }),
        makeRes()
      )
    ).rejects.toThrow(NotFoundError);
    expect(dbBuilders.project_patterns.update).not.toHaveBeenCalled();
  });
});
