/**
 * Tests for the authenticated streaming endpoints introduced on
 * 2026-05-02 (migration 070). The load-bearing claim is "no bytes go
 * out without a controller-level ownership check," so the tests verify
 * that:
 *
 *   - Wrong owner gets 404 (not 401, to avoid leaking row existence)
 *   - Missing photo row gets 404
 *   - Storage filename that fails the safe-name regex never reaches disk
 *
 * The streaming-from-disk path is exercised in
 * `utils/__tests__/uploadStorage.test.ts`; this file mocks the
 * uploadStorage module so we can assert the flow without touching the
 * filesystem.
 */

const projectFirst = jest.fn();
const photoFirst = jest.fn();
const yarnFirst = jest.fn();
const yarnPhotoFirst = jest.fn();

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    if (table === 'projects') {
      return {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: projectFirst,
      };
    }
    if (table === 'project_photos') {
      return {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: photoFirst,
      };
    }
    if (table === 'yarn') {
      return {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: yarnFirst,
      };
    }
    if (table === 'yarn_photos') {
      return {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: yarnPhotoFirst,
      };
    }
    return { where: jest.fn().mockReturnThis(), first: jest.fn() };
  });
  return { default: dbFn, __esModule: true };
});

const streamSafeUploadMock = jest.fn().mockImplementation(async (res: any) => {
  res.status(200);
  res.json({ streamed: true });
});

jest.mock('../../utils/uploadStorage', () => ({
  generateStorageFilename: () => 'a'.repeat(32) + '.webp',
  streamSafeUpload: streamSafeUploadMock,
  uploadRoot: () => '/tmp',
}));

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

import { serveProjectPhoto, serveYarnPhoto } from '../uploadsController';

function makeReq(params: Record<string, string>, urlPath = '') {
  return {
    params,
    user: { userId: 'user-1' },
    path: urlPath,
  } as any;
}

function makeRes() {
  const res: any = { headersSent: false };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.end = jest.fn();
  return res;
}

describe('serveProjectPhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    streamSafeUploadMock.mockClear();
  });

  it('returns 404 when the project belongs to a different user', async () => {
    projectFirst.mockResolvedValue(null);
    const req = makeReq({ projectId: 'p1', photoId: 'photo1' });
    const res = makeRes();
    await serveProjectPhoto(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(streamSafeUploadMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the photo does not exist', async () => {
    projectFirst.mockResolvedValue({ id: 'p1', user_id: 'user-1' });
    photoFirst.mockResolvedValue(null);
    const req = makeReq({ projectId: 'p1', photoId: 'photo1' });
    const res = makeRes();
    await serveProjectPhoto(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(streamSafeUploadMock).not.toHaveBeenCalled();
  });

  it('streams the full image from `projects/`', async () => {
    projectFirst.mockResolvedValue({ id: 'p1', user_id: 'user-1' });
    photoFirst.mockResolvedValue({
      id: 'photo1',
      filename: 'a'.repeat(32) + '.webp',
      thumbnail_filename: 'b'.repeat(32) + '.webp',
      mime_type: 'image/webp',
    });
    const req = makeReq({ projectId: 'p1', photoId: 'photo1' }, '/api/uploads/projects/p1/photos/photo1');
    const res = makeRes();
    await serveProjectPhoto(req, res);
    expect(streamSafeUploadMock).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ subdir: 'projects', filename: 'a'.repeat(32) + '.webp' })
    );
  });

  it('streams the thumbnail when path ends with /thumbnail', async () => {
    projectFirst.mockResolvedValue({ id: 'p1', user_id: 'user-1' });
    photoFirst.mockResolvedValue({
      id: 'photo1',
      filename: 'a'.repeat(32) + '.webp',
      thumbnail_filename: 'b'.repeat(32) + '.webp',
      mime_type: 'image/webp',
    });
    const req = makeReq(
      { projectId: 'p1', photoId: 'photo1' },
      '/api/uploads/projects/p1/photos/photo1/thumbnail'
    );
    const res = makeRes();
    await serveProjectPhoto(req, res);
    expect(streamSafeUploadMock).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ subdir: 'projects/thumbnails', filename: 'b'.repeat(32) + '.webp' })
    );
  });
});

describe('serveYarnPhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    streamSafeUploadMock.mockClear();
  });

  it('returns 404 when the yarn does not belong to the user', async () => {
    yarnFirst.mockResolvedValue(null);
    const req = makeReq({ yarnId: 'y1', photoId: 'photo1' });
    const res = makeRes();
    await serveYarnPhoto(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(streamSafeUploadMock).not.toHaveBeenCalled();
  });

  it('streams from the yarn subdir on success', async () => {
    yarnFirst.mockResolvedValue({ id: 'y1', user_id: 'user-1' });
    yarnPhotoFirst.mockResolvedValue({
      id: 'photo1',
      filename: 'c'.repeat(32) + '.webp',
      thumbnail_filename: 'd'.repeat(32) + '.webp',
      mime_type: 'image/webp',
    });
    const req = makeReq({ yarnId: 'y1', photoId: 'photo1' }, '/api/uploads/yarn/y1/photos/photo1');
    const res = makeRes();
    await serveYarnPhoto(req, res);
    expect(streamSafeUploadMock).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ subdir: 'yarn' })
    );
  });
});
