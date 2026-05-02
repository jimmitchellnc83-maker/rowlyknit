/**
 * Verifies the slug-gated public photo endpoint added on 2026-05-02.
 * The slug must resolve a project that is currently `is_public=true`,
 * else the request 404s. Unpublishing a project therefore kills photo
 * URLs without rewriting any rows.
 */

const projectFirst = jest.fn();
const photoFirst = jest.fn();

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
    return { where: jest.fn().mockReturnThis(), first: jest.fn() };
  });
  return { default: dbFn, __esModule: true };
});

const streamSafeUploadMock = jest.fn().mockImplementation(async (res: any) => {
  res.status(200);
  res.json({ streamed: true });
});

jest.mock('../../utils/uploadStorage', () => ({
  streamSafeUpload: streamSafeUploadMock,
}));

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

import { viewSharedProjectPhoto } from '../projectSharingController';

function makeReq(params: Record<string, string>, urlPath = '') {
  return { params, path: urlPath } as any;
}

function makeRes() {
  const res: any = { headersSent: false };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
}

describe('viewSharedProjectPhoto', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    streamSafeUploadMock.mockClear();
  });

  it('returns 404 when the slug points at no public project', async () => {
    projectFirst.mockResolvedValue(null);
    const res = makeRes();
    await viewSharedProjectPhoto(makeReq({ slug: 'unknown', photoId: 'p1' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(streamSafeUploadMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the project exists but the photo does not', async () => {
    projectFirst.mockResolvedValue({ id: 'project-1' });
    photoFirst.mockResolvedValue(null);
    const res = makeRes();
    await viewSharedProjectPhoto(makeReq({ slug: 'pub', photoId: 'p1' }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(streamSafeUploadMock).not.toHaveBeenCalled();
  });

  it('streams the full image when the slug + photo resolve', async () => {
    projectFirst.mockResolvedValue({ id: 'project-1' });
    photoFirst.mockResolvedValue({
      filename: 'a'.repeat(32) + '.webp',
      thumbnail_filename: 'b'.repeat(32) + '.webp',
      mime_type: 'image/webp',
    });
    const res = makeRes();
    await viewSharedProjectPhoto(
      makeReq({ slug: 'pub', photoId: 'p1' }, '/shared/project/pub/photos/p1'),
      res
    );
    expect(streamSafeUploadMock).toHaveBeenCalledWith(
      res,
      expect.objectContaining({
        subdir: 'projects',
        filename: 'a'.repeat(32) + '.webp',
        cacheControl: 'public, max-age=86400',
      })
    );
  });

  it('streams the thumbnail when path ends with /thumbnail', async () => {
    projectFirst.mockResolvedValue({ id: 'project-1' });
    photoFirst.mockResolvedValue({
      filename: 'a'.repeat(32) + '.webp',
      thumbnail_filename: 'b'.repeat(32) + '.webp',
      mime_type: 'image/webp',
    });
    const res = makeRes();
    await viewSharedProjectPhoto(
      makeReq({ slug: 'pub', photoId: 'p1' }, '/shared/project/pub/photos/p1/thumbnail'),
      res
    );
    expect(streamSafeUploadMock).toHaveBeenCalledWith(
      res,
      expect.objectContaining({ subdir: 'projects/thumbnails' })
    );
  });
});
