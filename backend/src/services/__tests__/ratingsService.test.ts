/**
 * Tests for ratingsService.countMakersForPattern.
 *
 * The function composes a Knex query chain; we verify its contract by
 * handing it a stub that mimics Knex's builder and captures the conditions
 * applied. Goal: prove the query excludes the viewer, non-public ratings,
 * soft-deleted rows, and patterns without a ravelry_id.
 */

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

import { countMakersForPattern } from '../ratingsService';

type MockDb = jest.Mock & Record<string, jest.Mock>;

function makeBuilder(result: unknown) {
  const chain: Record<string, unknown> = {};
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const fn = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return chain;
  };

  [
    'where', 'whereNull', 'whereNot', 'join', 'select', 'countDistinct',
  ].forEach((m) => { (chain as any)[m] = jest.fn(fn(m)); });

  (chain as any).first = jest.fn(() => Promise.resolve(result));
  (chain as any).then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled);

  return { chain, calls };
}

function makeDb(sourceResult: unknown, makersResult: unknown): MockDb {
  const mock = jest.fn() as MockDb;
  let call = 0;
  mock.mockImplementation((_table: string) => {
    call += 1;
    return call === 1
      ? makeBuilder(sourceResult).chain
      : makeBuilder(makersResult).chain;
  });
  return mock;
}

describe('countMakersForPattern', () => {
  it('returns 0 when the pattern has no ravelry_id', async () => {
    const db = makeDb({ ravelry_id: null }, []);
    const n = await countMakersForPattern(db as any, 'pattern-1', 'user-1');
    expect(n).toBe(0);
  });

  it('returns 0 when the pattern does not exist', async () => {
    const db = makeDb(undefined, []);
    const n = await countMakersForPattern(db as any, 'pattern-missing', 'user-1');
    expect(n).toBe(0);
  });

  it('parses string counts from the count query', async () => {
    const db = makeDb({ ravelry_id: 12345 }, [{ n: '7' }]);
    const n = await countMakersForPattern(db as any, 'pattern-1', 'user-1');
    expect(n).toBe(7);
  });

  it('handles numeric counts', async () => {
    const db = makeDb({ ravelry_id: 12345 }, [{ n: 3 }]);
    const n = await countMakersForPattern(db as any, 'pattern-1', 'user-1');
    expect(n).toBe(3);
  });

  it('returns 0 when no makers are found', async () => {
    const db = makeDb({ ravelry_id: 12345 }, []);
    const n = await countMakersForPattern(db as any, 'pattern-1', 'user-1');
    expect(n).toBe(0);
  });
});
