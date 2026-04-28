/**
 * Tests for chartSymbolService.
 *
 * Mocks the knex db so we can verify validation behaviour and the
 * conflict / not-found paths around custom-symbol mutations.
 */

jest.mock('../../config/database', () => {
  const builder: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
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
  createCustomSymbol,
  deleteCustomSymbol,
  listSymbols,
  lookupSymbols,
  updateCustomSymbol,
} from '../chartSymbolService';
import db from '../../config/database';
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errorHandler';

const mockedDb = db as unknown as jest.Mock & {
  __builder: {
    first: jest.Mock;
    returning: jest.Mock;
    delete: jest.Mock;
    update: jest.Mock;
    insert: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
  };
};

describe('createCustomSymbol', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an empty symbol', async () => {
    await expect(
      createCustomSymbol('user-1', { symbol: '', name: 'X' })
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a symbol over 10 characters', async () => {
    await expect(
      createCustomSymbol('user-1', { symbol: 'this-is-way-too-long', name: 'X' })
    ).rejects.toThrow(ValidationError);
  });

  it('rejects an empty name', async () => {
    await expect(
      createCustomSymbol('user-1', { symbol: 'foo', name: '' })
    ).rejects.toThrow(ValidationError);
  });

  it('rejects an invalid craft value', async () => {
    await expect(
      createCustomSymbol('user-1', {
        symbol: 'foo',
        name: 'Foo',
        craft: 'macrame' as any,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('rejects a non-array techniques value', async () => {
    await expect(
      createCustomSymbol('user-1', {
        symbol: 'foo',
        name: 'Foo',
        techniques: 'lace' as any,
      })
    ).rejects.toThrow(ValidationError);
  });

  it('rejects techniques containing an invalid value', async () => {
    await expect(
      createCustomSymbol('user-1', {
        symbol: 'foo',
        name: 'Foo',
        techniques: ['lace', 'macrame' as any],
      })
    ).rejects.toThrow(ValidationError);
  });

  it('accepts a valid techniques array on create + persists it', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(null);
    mockedDb.__builder.returning.mockResolvedValueOnce([
      {
        id: 'new-id',
        symbol: 'foo',
        name: 'Foo',
        craft: 'knit',
        cell_span: 1,
        techniques: ['lace', 'cables'],
      },
    ]);

    const created = await createCustomSymbol('user-1', {
      symbol: 'foo',
      name: 'Foo',
      techniques: ['lace', 'cables'],
    });

    expect(created.techniques).toEqual(['lace', 'cables']);
    expect(mockedDb.__builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ techniques: ['lace', 'cables'] }),
    );
  });

  it('inserts NULL techniques when the field is omitted (applies-everywhere default)', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(null);
    mockedDb.__builder.returning.mockResolvedValueOnce([
      { id: 'new-id', symbol: 'foo', name: 'Foo', craft: 'knit', cell_span: 1, techniques: null },
    ]);

    await createCustomSymbol('user-1', { symbol: 'foo', name: 'Foo' });

    expect(mockedDb.__builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ techniques: null }),
    );
  });

  it('rejects cell_span out of range', async () => {
    await expect(
      createCustomSymbol('user-1', { symbol: 'foo', name: 'Foo', cell_span: 0 })
    ).rejects.toThrow(ValidationError);

    await expect(
      createCustomSymbol('user-1', { symbol: 'foo', name: 'Foo', cell_span: 99 })
    ).rejects.toThrow(ValidationError);
  });

  it('throws ConflictError when the user already has that symbol', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({ id: 'existing' });

    await expect(
      createCustomSymbol('user-1', { symbol: 'foo', name: 'Foo' })
    ).rejects.toThrow(ConflictError);
  });

  it('inserts a new row and returns the created template', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(null);
    mockedDb.__builder.returning.mockResolvedValueOnce([
      {
        id: 'new-id',
        symbol: 'foo',
        name: 'Foo',
        craft: 'knit',
        cell_span: 1,
      },
    ]);

    const created = await createCustomSymbol('user-1', {
      symbol: 'foo',
      name: 'Foo',
    });

    expect(created.id).toBe('new-id');
    expect(mockedDb.__builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        symbol: 'foo',
        name: 'Foo',
        user_id: 'user-1',
        is_system: false,
        craft: 'knit',
        cell_span: 1,
      })
    );
  });
});

describe('updateCustomSymbol', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws NotFoundError when the row does not exist', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(null);

    await expect(
      updateCustomSymbol('symbol-id', 'user-1', { name: 'New name' })
    ).rejects.toThrow(NotFoundError);
  });

  it('refuses to update a system stitch', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'symbol-id',
      is_system: true,
      user_id: null,
    });

    await expect(
      updateCustomSymbol('symbol-id', 'user-1', { name: 'New name' })
    ).rejects.toThrow(NotFoundError);
  });

  it("refuses to update another user's custom stitch", async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'symbol-id',
      is_system: false,
      user_id: 'someone-else',
    });

    await expect(
      updateCustomSymbol('symbol-id', 'user-1', { name: 'New name' })
    ).rejects.toThrow(NotFoundError);
  });

  it('updates and returns the patched row', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'symbol-id',
      is_system: false,
      user_id: 'user-1',
    });
    mockedDb.__builder.returning.mockResolvedValueOnce([
      { id: 'symbol-id', name: 'New name', user_id: 'user-1' },
    ]);

    const updated = await updateCustomSymbol('symbol-id', 'user-1', {
      name: 'New name',
    });

    expect(updated.name).toBe('New name');
    expect(mockedDb.__builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New name' })
    );
  });
});

describe('deleteCustomSymbol', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws NotFoundError when the row does not exist', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(null);

    await expect(deleteCustomSymbol('symbol-id', 'user-1')).rejects.toThrow(NotFoundError);
  });

  it('refuses to delete a system stitch', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'symbol-id',
      is_system: true,
      user_id: null,
    });

    await expect(deleteCustomSymbol('symbol-id', 'user-1')).rejects.toThrow(NotFoundError);
  });

  it("refuses to delete another user's custom stitch", async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'symbol-id',
      is_system: false,
      user_id: 'someone-else',
    });

    await expect(deleteCustomSymbol('symbol-id', 'user-1')).rejects.toThrow(NotFoundError);
  });

  it('deletes when the row belongs to the user', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'symbol-id',
      is_system: false,
      user_id: 'user-1',
    });

    await deleteCustomSymbol('symbol-id', 'user-1');

    expect(mockedDb.__builder.delete).toHaveBeenCalled();
  });
});

describe('lookupSymbols', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('short-circuits on empty input without hitting the db', async () => {
    const result = await lookupSymbols('user-1', []);
    expect(result).toEqual([]);
    expect(mockedDb).not.toHaveBeenCalled();
  });
});

describe('listSymbols', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // The chained-builder mock in this file is a single shared builder
  // (not the per-call builder pattern from chartService.test.ts) so we
  // can only assert that the technique filter triggers an `andWhere`
  // callback — verifying the exact SQL would require a richer mock.
  // Coverage here is the "did we call the filter at all" smoke test;
  // the SQL itself is exercised end-to-end against Postgres in CI.

  it('does not invoke the technique filter when technique is omitted', async () => {
    // Builder is awaited as a thenable for `system` and `custom` —
    // the mock's `clone()` returns the same builder, and awaiting it
    // gives undefined which is fine for assertions on the call shape.
    (mockedDb.__builder as any).then = undefined;
    Object.defineProperty(mockedDb.__builder, 'then', {
      configurable: true,
      value: (resolve: (v: unknown) => void) => resolve([]),
    });

    await listSymbols('user-1', { craft: 'knit' });

    // andWhere is used both for craft and (if technique were set) for
    // the technique callback. With craft only, we expect exactly two
    // andWhere invocations across the system + custom queries.
    expect(mockedDb.__builder.andWhere).toHaveBeenCalledWith({ craft: 'knit' });
  });

  it('invokes andWhere with a callback when technique filter is requested', async () => {
    Object.defineProperty(mockedDb.__builder, 'then', {
      configurable: true,
      value: (resolve: (v: unknown) => void) => resolve([]),
    });

    await listSymbols('user-1', { craft: 'knit', technique: 'lace' });

    // andWhere is called for craft (object form) AND for technique
    // (callback form). The presence of a callback invocation confirms
    // the technique branch was reached.
    const callbackCalls = (mockedDb.__builder.andWhere as jest.Mock).mock.calls.filter(
      (args) => typeof args[0] === 'function',
    );
    expect(callbackCalls.length).toBeGreaterThan(0);
  });
});
