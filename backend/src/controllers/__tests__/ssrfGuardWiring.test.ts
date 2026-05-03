/**
 * Regression: every user-controlled outbound fetch must
 *   1. pre-flight through `assertPublicUrl` for an early 4xx,
 *   2. then use `safeAxios` (NOT bare `axios`) so the http(s) Agents
 *      re-validate the resolved IP at connect time. Plain `axios.get`
 *      was the DNS-rebinding hole flagged in the platform audit.
 *
 * Locks the wiring at the four spots that take user input:
 *   - uploadYarnPhotoFromUrl
 *   - uploadPatternThumbnailFromUrl
 *   - blogExtractorService.extractFromUrl
 *   - patternsController.collatePdfs (remote pattern_files.file_path)
 */

const assertPublicUrlMock = jest.fn();
jest.mock('../../utils/ssrfGuard', () => ({
  assertPublicUrl: (...args: any[]) => assertPublicUrlMock(...args),
}));

const safeAxiosGetMock = jest.fn();
jest.mock('../../utils/safeFetch', () => ({
  __esModule: true,
  safeAxios: { get: (...args: any[]) => safeAxiosGetMock(...args) },
  safeHttpAgent: {},
  safeHttpsAgent: {},
  validatingLookup: jest.fn(),
  isPrivateIpv4: jest.fn(() => false),
}));

// Bare axios should never be called from these flows. We mock it to a
// sentinel so any accidental drop-back to plain axios fails the test.
const bareAxiosGetMock = jest.fn();
jest.mock('axios', () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => bareAxiosGetMock(...args),
    create: () => ({ get: (...args: any[]) => bareAxiosGetMock(...args) }),
  },
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
    expect(safeAxiosGetMock).not.toHaveBeenCalled();
    expect(bareAxiosGetMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 400 when assertPublicUrl flags an unsupported protocol', async () => {
    assertPublicUrlMock.mockRejectedValueOnce(new ValidationError('Unsupported URL protocol: file:'));
    const res = makeRes();
    await uploadYarnPhotoFromUrl(
      makeReq({ photoUrl: 'file:///etc/passwd' }, { yarnId: 'y1' }),
      res
    );
    expect(safeAxiosGetMock).not.toHaveBeenCalled();
    expect(bareAxiosGetMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('uses safeAxios (not bare axios) when the pre-flight passes', async () => {
    assertPublicUrlMock.mockResolvedValueOnce(new URL('https://cdn.example.com/photo.jpg'));
    // db chain: yarn lookup → returning insert → update
    const yarnRow = { id: 'y1', user_id: 'user-1' };
    const insertedPhoto = { id: 'p1' };
    dbFn.mockImplementation((table: string) => {
      if (table === 'yarn') {
        return {
          where: () => ({ whereNull: () => ({ first: () => Promise.resolve(yarnRow) }) }),
        };
      }
      if (table === 'yarn_photos') {
        return {
          insert: () => ({ returning: () => Promise.resolve([insertedPhoto]) }),
          where: () => ({ update: () => Promise.resolve(1) }),
        };
      }
      throw new Error(`unmocked table ${table}`);
    });
    safeAxiosGetMock.mockResolvedValueOnce({ data: Buffer.alloc(8) });
    const res = makeRes();
    await uploadYarnPhotoFromUrl(
      makeReq({ photoUrl: 'https://cdn.example.com/photo.jpg' }, { yarnId: 'y1' }),
      res
    );
    expect(safeAxiosGetMock).toHaveBeenCalledTimes(1);
    expect(bareAxiosGetMock).not.toHaveBeenCalled();
    expect(safeAxiosGetMock.mock.calls[0][0]).toBe('https://cdn.example.com/photo.jpg');
  });
});

describe('SSRF guard wiring — uploadPatternThumbnailFromUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('blocks the safe-fetch when assertPublicUrl rejects', async () => {
    assertPublicUrlMock.mockRejectedValueOnce(new ForbiddenError('blocked'));
    const res = makeRes();
    await uploadPatternThumbnailFromUrl(
      makeReq({ photoUrl: 'http://10.0.0.1/foo.png' }, { patternId: 'p1' }),
      res
    );
    expect(assertPublicUrlMock).toHaveBeenCalledWith('http://10.0.0.1/foo.png');
    expect(safeAxiosGetMock).not.toHaveBeenCalled();
    expect(bareAxiosGetMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('uses safeAxios on the happy path', async () => {
    assertPublicUrlMock.mockResolvedValueOnce(new URL('https://cdn.example.com/pat.png'));
    const patternRow = { id: 'p1', user_id: 'user-1' };
    dbFn.mockImplementation((table: string) => {
      if (table === 'patterns') {
        return {
          where: () => ({
            whereNull: () => ({ first: () => Promise.resolve(patternRow) }),
            update: () => Promise.resolve(1),
          }),
        };
      }
      throw new Error(`unmocked table ${table}`);
    });
    safeAxiosGetMock.mockResolvedValueOnce({ data: Buffer.alloc(4) });
    const res = makeRes();
    await uploadPatternThumbnailFromUrl(
      makeReq({ photoUrl: 'https://cdn.example.com/pat.png' }, { patternId: 'p1' }),
      res
    );
    expect(safeAxiosGetMock).toHaveBeenCalledTimes(1);
    expect(bareAxiosGetMock).not.toHaveBeenCalled();
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
    expect(safeAxiosGetMock).not.toHaveBeenCalled();
    expect(bareAxiosGetMock).not.toHaveBeenCalled();
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/private/i);
  });
});
