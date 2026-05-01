/**
 * Tests for abbreviationService.
 *
 * Mocks the knex db so we can verify the where-clause shape and the
 * search / category / craft filter wiring.
 */

jest.mock('../../config/database', () => {
  const builder: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    orWhereRaw: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    orderByRaw: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    first: jest.fn(),
    // The query builder is awaited as a Promise — Jest's mock returns
    // the builder, so the final `await query` resolves to the builder
    // itself, which we override per-test by giving it a `then` field
    // pointing at an array. We use `.mockResolvedValue` on a method to
    // shape the return where needed.
    then: function (resolve: (rows: unknown[]) => unknown) {
      return Promise.resolve(this.__rows ?? []).then(resolve);
    },
    __rows: [] as unknown[],
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
  categoryCounts,
  isCraft,
  listAbbreviations,
  lookupAbbreviation,
  VALID_CRAFTS,
} from '../abbreviationService';
import db from '../../config/database';

const mockedDb = db as unknown as jest.Mock & {
  __builder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    whereNull: jest.Mock;
    whereRaw: jest.Mock;
    orWhereRaw: jest.Mock;
    orderBy: jest.Mock;
    orderByRaw: jest.Mock;
    select: jest.Mock;
    count: jest.Mock;
    groupBy: jest.Mock;
    first: jest.Mock;
    __rows: unknown[];
  };
};

describe('isCraft', () => {
  it.each(VALID_CRAFTS)('accepts %s', (craft) => {
    expect(isCraft(craft)).toBe(true);
  });

  it('rejects unknown crafts', () => {
    expect(isCraft('macrame')).toBe(false);
    expect(isCraft('')).toBe(false);
    expect(isCraft(null)).toBe(false);
    expect(isCraft(undefined)).toBe(false);
    expect(isCraft(42)).toBe(false);
  });
});

describe('listAbbreviations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDb.__builder.__rows = [];
  });

  it('defaults to system rows only when no userId is supplied', async () => {
    await listAbbreviations({});
    // `where({ is_system: true })` then `whereNull('user_id')`.
    expect(mockedDb.__builder.where).toHaveBeenCalledWith({ is_system: true });
    expect(mockedDb.__builder.whereNull).toHaveBeenCalledWith('user_id');
  });

  it('includes the user\'s custom rows when userId is supplied', async () => {
    await listAbbreviations({ userId: 'user-7' });
    // The userId branch wires the WHERE through a callback, so we verify
    // a callback was registered (where called with a function).
    const calls = mockedDb.__builder.where.mock.calls;
    const callbackCall = calls.find((c) => typeof c[0] === 'function');
    expect(callbackCall).toBeDefined();
  });

  it('applies craft filter via andWhere', async () => {
    await listAbbreviations({ craft: 'crochet' });
    expect(mockedDb.__builder.andWhere).toHaveBeenCalledWith({ craft: 'crochet' });
  });

  it('applies category filter via andWhere', async () => {
    await listAbbreviations({ category: 'decrease' });
    expect(mockedDb.__builder.andWhere).toHaveBeenCalledWith({ category: 'decrease' });
  });

  it('applies search across abbreviation/expansion/description with ILIKE', async () => {
    await listAbbreviations({ search: 'cable' });
    // The search branch registers an andWhere(callback) that calls
    // whereRaw inside. We verify whereRaw was called (it's invoked on
    // the same chained builder mock by the inner callback).
    const andWhereCalls = mockedDb.__builder.andWhere.mock.calls;
    const callbackCall = andWhereCalls.find((c) => typeof c[0] === 'function');
    expect(callbackCall).toBeDefined();
    // Invoke the callback against the mock to exercise the inner whereRaw.
    callbackCall?.[0](mockedDb.__builder);
    expect(mockedDb.__builder.whereRaw).toHaveBeenCalledWith(
      'abbreviation ILIKE ?',
      ['%cable%']
    );
  });

  it('escapes LIKE special characters in the search needle', async () => {
    await listAbbreviations({ search: '50%_off' });
    const andWhereCalls = mockedDb.__builder.andWhere.mock.calls;
    const callbackCall = andWhereCalls.find((c) => typeof c[0] === 'function');
    callbackCall?.[0](mockedDb.__builder);
    expect(mockedDb.__builder.whereRaw).toHaveBeenCalledWith(
      'abbreviation ILIKE ?',
      ['%50\\%\\_off%']
    );
  });

  it('treats empty / whitespace search as no filter', async () => {
    await listAbbreviations({ search: '   ' });
    // The whereRaw should NOT have been called for the search branch.
    const whereRawCalls = mockedDb.__builder.whereRaw.mock.calls;
    const searchCall = whereRawCalls.find(
      (c) => typeof c[0] === 'string' && c[0].includes('ILIKE')
    );
    expect(searchCall).toBeUndefined();
  });
});

describe('lookupAbbreviation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries by exact abbreviation + craft + is_system + user_id NULL', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce({
      id: 'abbr-1',
      abbreviation: 'k2tog',
      craft: 'knit',
    });
    const result = await lookupAbbreviation('k2tog', 'knit');
    expect(result).toMatchObject({ abbreviation: 'k2tog', craft: 'knit' });
    expect(mockedDb.__builder.where).toHaveBeenCalledWith({
      abbreviation: 'k2tog',
      craft: 'knit',
      is_system: true,
    });
    expect(mockedDb.__builder.whereNull).toHaveBeenCalledWith('user_id');
  });

  it('returns null when the row is not found', async () => {
    mockedDb.__builder.first.mockResolvedValueOnce(undefined);
    const result = await lookupAbbreviation('not-a-real-thing', 'knit');
    expect(result).toBeNull();
  });

  it('does NOT do case-insensitive matching (BO !== bo)', async () => {
    // Driven by the equality test on { abbreviation, ... } — we just
    // verify the value passed in is the verbatim string. The DB-level
    // unique index is the actual case-sensitivity guarantee.
    mockedDb.__builder.first.mockResolvedValueOnce(null);
    await lookupAbbreviation('BO', 'knit');
    expect(mockedDb.__builder.where).toHaveBeenCalledWith({
      abbreviation: 'BO',
      craft: 'knit',
      is_system: true,
    });
  });
});

describe('categoryCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDb.__builder.__rows = [];
  });

  it('always restricts to system rows', async () => {
    mockedDb.__builder.__rows = [
      { category: 'stitch', count: '12' },
      { category: 'decrease', count: '3' },
    ];
    const result = await categoryCounts();
    expect(mockedDb.__builder.where).toHaveBeenCalledWith({ is_system: true });
    expect(mockedDb.__builder.whereNull).toHaveBeenCalledWith('user_id');
    expect(result).toEqual([
      { category: 'stitch', count: 12 },
      { category: 'decrease', count: 3 },
    ]);
  });

  it('passes craft through to andWhere when supplied', async () => {
    mockedDb.__builder.__rows = [];
    await categoryCounts('tunisian');
    expect(mockedDb.__builder.andWhere).toHaveBeenCalledWith({ craft: 'tunisian' });
  });

  it('omits the craft filter when not supplied', async () => {
    mockedDb.__builder.__rows = [];
    await categoryCounts();
    const calls = mockedDb.__builder.andWhere.mock.calls;
    expect(calls.length).toBe(0);
  });
});
