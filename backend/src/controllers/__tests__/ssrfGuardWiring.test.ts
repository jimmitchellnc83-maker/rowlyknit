/**
 * Regression: the from-URL upload paths and the blog importer must
 * route through `assertPublicUrl` BEFORE any axios.get() is fired,
 * else an attacker can pivot the outbound fetch at internal services
 * (169.254.169.254 cloud-metadata, RFC-1918 boxes, loopback).
 *
 * The guard itself has its own coverage; here we lock in that the
 * three spots flagged in the platform audit (uploadYarnPhotoFromUrl,
 * uploadPatternThumbnailFromUrl, blogExtractorService.extractFromUrl)
 * actually call it.
 */

const assertPublicUrlMock = jest.fn();
jest.mock('../../utils/ssrfGuard', () => ({
  assertPublicUrl: (...args: any[]) => assertPublicUrlMock(...args),
}));

const axiosGetMock = jest.fn();
jest.mock('axios', () => ({
  __esModule: true,
  default: { get: (...args: any[]) => axiosGetMock(...args) },
}));

const dbFn = jest.fn();
jest.mock('../../config/database', () => ({ default: dbFn, __esModule: true }));

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

jest.mock('sharp', () =>
  jest.fn(() => ({
    metadata: () => Promise.resolve({ width: 100, height: 100 }),
    resize: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    toFile: () => Promise.resolve(),
  }))
);

jest.mock('../../utils/uploadStorage', () => ({
  generateStorageFilename: () => 'a'.repeat(32) + '.webp',
  streamSafeUpload: jest.fn(),
  uploadRoot: () => '/tmp',
}));

import {
  uploadYarnPhotoFromUrl,
  uploadPatternThumbnailFromUrl,
} from '../uploadsController';
import { ForbiddenError, ValidationError } from '../../utils/errorHandler';

function makeReq(body: any, params: any = {}) {
  return { body, params, user: { userId: 'user-1' }, socket: { setTimeout: jest.fn() } } as any;
}

function makeRes() {
  const res: any = { headersSent: false };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  return res;
}

describe('SSRF guard wiring — uploadYarnPhotoFromUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when assertPublicUrl flags a private destination', async () => {
    assertPublicUrlMock.mockRejectedValueOnce(
      new ForbiddenError('URL resolves to a private/internal address: 169.254.169.254')
    );
    const res = makeRes();
    await uploadYarnPhotoFromUrl(
      makeReq({ photoUrl: 'http://169.254.169.254/' }, { yarnId: 'y1' }),
      res
    );
    expect(assertPublicUrlMock).toHaveBeenCalledWith('http://169.254.169.254/');
    expect(axiosGetMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when assertPublicUrl flags an unsupported protocol', async () => {
    assertPublicUrlMock.mockRejectedValueOnce(new ValidationError('Unsupported URL protocol: file:'));
    const res = makeRes();
    await uploadYarnPhotoFromUrl(
      makeReq({ photoUrl: 'file:///etc/passwd' }, { yarnId: 'y1' }),
      res
    );
    expect(axiosGetMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe('SSRF guard wiring — uploadPatternThumbnailFromUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks the axios.get when assertPublicUrl rejects', async () => {
    assertPublicUrlMock.mockRejectedValueOnce(new ForbiddenError('blocked'));
    const res = makeRes();
    await uploadPatternThumbnailFromUrl(
      makeReq({ photoUrl: 'http://10.0.0.1/foo.png' }, { patternId: 'p1' }),
      res
    );
    expect(assertPublicUrlMock).toHaveBeenCalledWith('http://10.0.0.1/foo.png');
    expect(axiosGetMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('SSRF guard wiring — blogExtractorService.extractFromUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Make the db mock route past the import-record insert.
    dbFn.mockImplementation(() => ({
      insert: () => ({ returning: () => Promise.resolve([{ id: 'import-1' }]) }),
      where: () => ({ update: () => Promise.resolve(1) }),
    }));
  });

  it('marks the import as failed when assertPublicUrl rejects', async () => {
    assertPublicUrlMock.mockRejectedValueOnce(new ForbiddenError('private destination'));

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const blogExtractor = require('../../services/blogExtractorService').default;
    const result = await blogExtractor.extractFromUrl('user-1', 'http://127.0.0.1/blog');

    expect(assertPublicUrlMock).toHaveBeenCalledWith('http://127.0.0.1/blog');
    expect(axiosGetMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/private/i);
  });
});
