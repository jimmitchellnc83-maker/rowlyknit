/**
 * Tests for the pattern-models HTTP controller — PR 5 of the Designer
 * rebuild.
 *
 * Mocks `patternService` (the data-layer dependency) so we can verify
 * input validation, status codes, and the unauthenticated path
 * without standing up a database.
 */

jest.mock('../../services/patternService', () => ({
  listPatterns: jest.fn(),
  getPattern: jest.fn(),
  createPattern: jest.fn(),
  updatePattern: jest.fn(),
  softDeletePattern: jest.fn(),
}));

import {
  create,
  getOne,
  list,
  remove,
  update,
} from '../../controllers/patternModelsController';
import {
  createPattern,
  getPattern,
  listPatterns,
  softDeletePattern,
  updatePattern,
} from '../../services/patternService';
import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils/errorHandler';

const mockedListPatterns = listPatterns as jest.Mock;
const mockedGetPattern = getPattern as jest.Mock;
const mockedCreatePattern = createPattern as jest.Mock;
const mockedUpdatePattern = updatePattern as jest.Mock;
const mockedSoftDeletePattern = softDeletePattern as jest.Mock;

const buildRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const buildReq = (overrides: any = {}) => ({
  user: { userId: 'user-1' },
  query: {},
  params: {},
  body: {},
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Auth gate
// ---------------------------------------------------------------------------

describe('auth gate', () => {
  it('rejects unauthenticated calls to list', async () => {
    await expect(list(buildReq({ user: undefined }) as any, buildRes())).rejects.toThrow(
      UnauthorizedError,
    );
  });

  it('rejects unauthenticated calls to getOne', async () => {
    await expect(
      getOne(buildReq({ user: undefined, params: { id: 'p1' } }) as any, buildRes()),
    ).rejects.toThrow(UnauthorizedError);
  });

  it('rejects unauthenticated calls to create', async () => {
    await expect(
      create(buildReq({ user: undefined }) as any, buildRes()),
    ).rejects.toThrow(UnauthorizedError);
  });
});

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

describe('list', () => {
  it('returns the service result wrapped in { success, data }', async () => {
    mockedListPatterns.mockResolvedValueOnce([{ id: 'p1' }]);
    const res = buildRes();
    await list(buildReq() as any, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id: 'p1' }] });
  });

  it('parses limit + offset + includeDeleted from query string', async () => {
    mockedListPatterns.mockResolvedValueOnce([]);
    const res = buildRes();
    await list(
      buildReq({
        query: { limit: '50', offset: '20', includeDeleted: 'true' },
      }) as any,
      res,
    );
    expect(mockedListPatterns).toHaveBeenCalledWith('user-1', {
      limit: 50,
      offset: 20,
      includeDeleted: true,
    });
  });

  it('caps limit at 200', async () => {
    mockedListPatterns.mockResolvedValueOnce([]);
    await list(buildReq({ query: { limit: '999' } }) as any, buildRes());
    expect(mockedListPatterns).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ limit: 200 }),
    );
  });
});

// ---------------------------------------------------------------------------
// getOne
// ---------------------------------------------------------------------------

describe('getOne', () => {
  it('throws NotFoundError when the service returns null', async () => {
    mockedGetPattern.mockResolvedValueOnce(null);
    await expect(
      getOne(buildReq({ params: { id: 'missing' } }) as any, buildRes()),
    ).rejects.toThrow(NotFoundError);
  });

  it('returns the pattern wrapped in { success, data } when found', async () => {
    mockedGetPattern.mockResolvedValueOnce({ id: 'p1' });
    const res = buildRes();
    await getOne(buildReq({ params: { id: 'p1' } }) as any, res);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 'p1' } });
  });
});

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe('create', () => {
  it('rejects an empty body', async () => {
    await expect(create(buildReq({ body: null }) as any, buildRes())).rejects.toThrow(
      ValidationError,
    );
  });

  it('rejects a missing name', async () => {
    await expect(
      create(buildReq({ body: { craft: 'knit' } }) as any, buildRes()),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a blank/whitespace name', async () => {
    await expect(
      create(buildReq({ body: { name: '   ', craft: 'knit' } }) as any, buildRes()),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects an invalid craft value', async () => {
    await expect(
      create(buildReq({ body: { name: 'X', craft: 'macrame' } }) as any, buildRes()),
    ).rejects.toThrow(ValidationError);
  });

  it('returns 201 + created pattern on success', async () => {
    mockedCreatePattern.mockResolvedValueOnce({ id: 'new', name: 'X' });
    const res = buildRes();
    await create(buildReq({ body: { name: 'X', craft: 'knit' } }) as any, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 'new', name: 'X' } });
  });
});

// ---------------------------------------------------------------------------
// update
// ---------------------------------------------------------------------------

describe('update', () => {
  it('rejects a non-object body', async () => {
    await expect(
      update(buildReq({ params: { id: 'p1' }, body: 'string' }) as any, buildRes()),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a blank name when name is provided', async () => {
    await expect(
      update(
        buildReq({ params: { id: 'p1' }, body: { name: '  ' } }) as any,
        buildRes(),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects an invalid technique value', async () => {
    await expect(
      update(
        buildReq({ params: { id: 'p1' }, body: { technique: 'bogus' } }) as any,
        buildRes(),
      ),
    ).rejects.toThrow(ValidationError);
  });

  it('passes a partial patch through to the service', async () => {
    mockedUpdatePattern.mockResolvedValueOnce({ id: 'p1', name: 'New' });
    const res = buildRes();
    await update(
      buildReq({ params: { id: 'p1' }, body: { name: 'New' } }) as any,
      res,
    );
    expect(mockedUpdatePattern).toHaveBeenCalledWith('p1', 'user-1', { name: 'New' });
    expect(res.json).toHaveBeenCalledWith({ success: true, data: { id: 'p1', name: 'New' } });
  });
});

// ---------------------------------------------------------------------------
// remove
// ---------------------------------------------------------------------------

describe('remove', () => {
  it('calls softDeletePattern + returns success', async () => {
    mockedSoftDeletePattern.mockResolvedValueOnce(undefined);
    const res = buildRes();
    await remove(buildReq({ params: { id: 'p1' } }) as any, res);
    expect(mockedSoftDeletePattern).toHaveBeenCalledWith('p1', 'user-1');
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});
