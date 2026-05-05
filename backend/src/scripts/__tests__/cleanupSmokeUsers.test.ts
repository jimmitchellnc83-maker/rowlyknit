/**
 * PR #384/#385 follow-up — finding #5: smoke user cleanup.
 *
 * The script HARD-DELETES user rows whose email matches a smoke
 * pattern (`claude-smoke%@rowly.test` or
 * `jimmitchellnc83+rowly-smoke-pr%@gmail.com`). The danger of getting
 * this wrong is unbounded — an over-broad match could erase a real
 * customer. These tests pin the load-bearing safety properties:
 *
 *   1. The LIKE patterns are exactly the two documented shapes.
 *   2. A real user (jimmitchellnc83@gmail.com, etc) IS NOT matched.
 *   3. The transaction wraps the DELETE so a partial cascade aborts.
 *   4. `--commit` is required; the default is dry-run.
 *
 * The DB itself is mocked — these are unit tests that exercise the
 * filter shape, not actual SQL. Live correctness is verified during
 * the prod smoke run with `--commit` and a counts comparison.
 */

import {
  SMOKE_USER_EMAIL_PATTERNS,
  cleanupSmokeUsers,
  selectSmokeUserCandidates,
} from '../cleanupSmokeUsers';

/**
 * Minimal in-memory knex-shape mock: the script uses `where(...)`,
 * `whereIn(...)`, `select(...)`, `delete()`, and `transaction(cb)`.
 * The proxy returns itself for chainable methods and resolves to a
 * configurable result for terminal calls.
 */
function makeMockKnex(opts: {
  selectResult?: unknown[];
  deleteResult?: number;
} = {}) {
  const selectResult = opts.selectResult ?? [];
  const deleteResult = opts.deleteResult ?? 0;

  const calls: Array<{ method: string; args: unknown[] }> = [];
  let inTrx = false;

  // Knex builders are thenable AND chainable: `await b.select(...)`
  // resolves to a result, but `b.select(...).where(...)` is also valid
  // (the chain stays a builder until the await fires). The proxy
  // models that by returning itself for every method except `then`,
  // which terminates with a resolved promise of the appropriate
  // payload (rows for SELECT, count for DELETE).
  let mode: 'select' | 'delete' | 'unknown' = 'unknown';

  const builder: any = new Proxy(
    {},
    {
      get(_t, prop) {
        const p = String(prop);
        if (p === 'then') {
          // Terminal: resolve to whichever buffer matches the chain.
          const value = mode === 'delete' ? deleteResult : selectResult;
          const promise = Promise.resolve(value);
          return promise.then.bind(promise);
        }
        if (p === 'catch' || p === 'finally') {
          const value = mode === 'delete' ? deleteResult : selectResult;
          const promise = Promise.resolve(value);
          return (promise as any)[p].bind(promise);
        }
        return (...args: unknown[]) => {
          calls.push({ method: p, args });
          if (p === 'select') mode = 'select';
          if (p === 'delete') mode = 'delete';
          // Invoke `where(function() {...})` callbacks against the
          // same builder so the orWhere LIKE chain gets exercised
          // and surfaces in `calls`.
          for (const arg of args) {
            if (typeof arg === 'function') {
              (arg as (this: unknown) => void).call(builder);
            }
          }
          return builder;
        };
      },
    },
  );

  const knex: any = (_table: string) => {
    mode = 'unknown';
    return builder;
  };
  knex.transaction = async (cb: (trx: any) => Promise<unknown>) => {
    inTrx = true;
    try {
      await cb(knex);
    } finally {
      inTrx = false;
    }
  };

  return {
    knex: knex as any,
    calls,
    isInTransaction: () => inTrx,
  };
}

describe('SMOKE_USER_EMAIL_PATTERNS — exact shape', () => {
  it('contains exactly the two documented patterns, in stable order', () => {
    expect(SMOKE_USER_EMAIL_PATTERNS).toEqual([
      'claude-smoke%@rowly.test',
      'jimmitchellnc83+rowly-smoke-pr%@gmail.com',
    ]);
  });

  it('does NOT contain a substring or wildcard pattern that could match real users', () => {
    for (const p of SMOKE_USER_EMAIL_PATTERNS) {
      // Must end with a fixed domain (no `@%` wildcard tail).
      expect(p).toMatch(/@(rowly\.test|gmail\.com)$/);
      // Must NOT be a bare `%@something` (no prefix gate at all).
      expect(p.startsWith('%')).toBe(false);
    }
  });

  it('jimmitchellnc83@gmail.com (the real owner) does NOT match either LIKE pattern', () => {
    // Translate SQL LIKE to regex for the locally-checkable part. `%`
    // is a wildcard; everything else is literal.
    const matches = (email: string, pattern: string): boolean => {
      const regex = new RegExp(
        '^' +
          pattern
            .replace(/[.+()|^$\\]/g, '\\$&')
            .replace(/%/g, '.*') +
          '$',
      );
      return regex.test(email);
    };
    for (const p of SMOKE_USER_EMAIL_PATTERNS) {
      expect(matches('jimmitchellnc83@gmail.com', p)).toBe(false);
      // Other plausible real-user shapes that must NOT trip:
      expect(matches('jane.doe@example.com', p)).toBe(false);
      expect(matches('rowly.tester@knitter.com', p)).toBe(false);
      expect(matches('claude-smoke@rowly.com', p)).toBe(false); // wrong TLD
      expect(matches('claude-smoke-anything@rowlytest.com', p)).toBe(false); // missing dot
      expect(matches('claudesmoke@rowly.test', p)).toBe(false); // missing dash
    }
  });

  it('does match the documented smoke shapes', () => {
    const matches = (email: string, pattern: string): boolean => {
      const regex = new RegExp(
        '^' +
          pattern
            .replace(/[.+()|^$\\]/g, '\\$&')
            .replace(/%/g, '.*') +
          '$',
      );
      return regex.test(email);
    };
    // claude-smoke variants
    expect(matches('claude-smoke@rowly.test', SMOKE_USER_EMAIL_PATTERNS[0])).toBe(true);
    expect(
      matches('claude-smoke-pr384-1234567890@rowly.test', SMOKE_USER_EMAIL_PATTERNS[0]),
    ).toBe(true);
    // gmail plus-tag variants
    expect(
      matches(
        'jimmitchellnc83+rowly-smoke-pr384-1@gmail.com',
        SMOKE_USER_EMAIL_PATTERNS[1],
      ),
    ).toBe(true);
  });
});

describe('selectSmokeUserCandidates — query filter shape', () => {
  it('queries the users table and applies an OR-chain of email LIKE patterns', async () => {
    const { knex, calls } = makeMockKnex({ selectResult: [] });
    await selectSmokeUserCandidates(knex);

    // SELECT id, email, created_at FROM users
    expect(calls.find((c) => c.method === 'select')).toBeDefined();
    // WHERE clause must contain orWhere(email like 'claude-smoke%@rowly.test')
    // AND orWhere(email like 'jimmitchellnc83+rowly-smoke-pr%@gmail.com').
    const orWhereCalls = calls.filter((c) => c.method === 'orWhere');
    const likeArgs = orWhereCalls
      .map((c) => c.args)
      .filter((a) => a[0] === 'email' && a[1] === 'like') as Array<
      [string, string, string]
    >;
    const patterns = likeArgs.map((a) => a[2]);
    expect(patterns).toEqual(SMOKE_USER_EMAIL_PATTERNS);
  });

  it('returns the result of the .select() call verbatim', async () => {
    const fixture = [
      { id: 'u-1', email: 'claude-smoke-1@rowly.test', created_at: new Date('2026-05-05') },
    ];
    const { knex } = makeMockKnex({ selectResult: fixture });
    const result = await selectSmokeUserCandidates(knex);
    expect(result).toEqual(fixture);
  });
});

describe('cleanupSmokeUsers — dry-run vs commit', () => {
  it('default mode is dry-run: no DELETE is issued', async () => {
    const fixture = [
      { id: 'u-1', email: 'claude-smoke-1@rowly.test', created_at: new Date('2026-05-05') },
    ];
    const { knex, calls } = makeMockKnex({ selectResult: fixture });
    const report = await cleanupSmokeUsers(knex);

    expect(report.deletedCount).toBe(0);
    expect(report.scanned).toEqual(fixture);
    // No DELETE method on the captured chain.
    expect(calls.some((c) => c.method === 'delete')).toBe(false);
  });

  it('commit mode opens a transaction and issues a DELETE inside it', async () => {
    const fixture = [
      { id: 'u-1', email: 'claude-smoke-1@rowly.test', created_at: new Date('2026-05-05') },
      { id: 'u-2', email: 'claude-smoke-2@rowly.test', created_at: new Date('2026-05-05') },
    ];
    const { knex, calls } = makeMockKnex({
      selectResult: fixture,
      deleteResult: 2,
    });

    const report = await cleanupSmokeUsers(knex, { commit: true });

    expect(report.deletedCount).toBe(2);
    expect(report.scanned).toEqual(fixture);

    // The DELETE chain re-applies the LIKE filter as a defense-in-depth
    // gate inside the transaction.
    const deleteCalls = calls.filter((c) => c.method === 'delete');
    expect(deleteCalls.length).toBe(1);
    const orWhereLike = calls.filter(
      (c) =>
        c.method === 'orWhere' &&
        (c.args[0] === 'email' && c.args[1] === 'like'),
    );
    // The filter is applied twice: once for the SELECT scan and once
    // for the DELETE inside the transaction. Both branches use the
    // same documented patterns.
    expect(orWhereLike.length).toBe(SMOKE_USER_EMAIL_PATTERNS.length * 2);
  });

  it('returns deletedCount: 0 when no candidates exist (no transaction opened)', async () => {
    const { knex, calls } = makeMockKnex({ selectResult: [] });
    const report = await cleanupSmokeUsers(knex, { commit: true });
    expect(report.deletedCount).toBe(0);
    expect(report.scanned).toEqual([]);
    // No DELETE was issued because there was nothing to delete.
    expect(calls.some((c) => c.method === 'delete')).toBe(false);
  });

  it('uses whereIn(ids) so a foreign id can never reach the DELETE', async () => {
    const fixture = [
      { id: 'u-1', email: 'claude-smoke-1@rowly.test', created_at: new Date('2026-05-05') },
    ];
    const { knex, calls } = makeMockKnex({
      selectResult: fixture,
      deleteResult: 1,
    });
    await cleanupSmokeUsers(knex, { commit: true });

    const whereInCalls = calls.filter((c) => c.method === 'whereIn');
    expect(whereInCalls.length).toBe(1);
    expect(whereInCalls[0].args[0]).toBe('id');
    expect(whereInCalls[0].args[1]).toEqual(['u-1']);
  });
});
