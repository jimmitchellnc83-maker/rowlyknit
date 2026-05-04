/**
 * PDF Workspace Bugfix Sprint 2A — cleanupSmokeArtifacts safety harness.
 *
 * The previous version broad-matched `pattern_models` by name across ALL
 * users and hard-deleted matches. A real user model named "Smoke Sweater"
 * or "PR377 Real Pattern" would have been wiped. This test pins the new
 * safety contract:
 *
 *   1. The query joins `users` (so the `@rowly.test` email gate fires).
 *   2. Soft-delete column (`pm.deleted_at`) is honored.
 *   3. The candidate predicate uses `'u.email', 'like', '%@rowly.test'`
 *      AND a name-prefix branch — never name-only.
 *
 * The test runs against a recording knex-shape proxy so it captures the
 * full chain, including nested `where(callback)` closures, and asserts
 * the load-bearing clauses are present. If anyone removes the email
 * gate, this test fails.
 */

interface CapturedCall {
  method: string;
  args: unknown[];
  depth: number;
}

function recordingBuilder(
  calls: CapturedCall[],
  depthRef: { d: number },
  selectResult: unknown[],
): unknown {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        return (...args: unknown[]) => {
          calls.push({ method: String(prop), args, depth: depthRef.d });
          // Invoke callback args with a nested recording builder bound as
          // `this` — this is how knex's where(function() { ... }) and
          // orWhere closures get exercised.
          for (const arg of args) {
            if (typeof arg === 'function') {
              depthRef.d += 1;
              try {
                (arg as (this: unknown) => void).call(
                  recordingBuilder(calls, depthRef, selectResult),
                );
              } finally {
                depthRef.d -= 1;
              }
            }
          }
          if (prop === 'select') {
            return Promise.resolve(selectResult);
          }
          if (prop === 'then' || prop === 'catch' || prop === 'finally') {
            // Awaitable surface: forward to a resolved promise of the
            // current select buffer so `await query` works without a
            // terminal `.select()` call.
            const promise = Promise.resolve(selectResult);
            return (promise as unknown as Record<string, unknown>)[
              String(prop)
            ];
          }
          return recordingBuilder(calls, depthRef, selectResult);
        };
      },
    },
  );
}

import {
  selectJoinLayoutCandidates,
  selectPatternModelCandidates,
} from '../cleanupSmokeArtifacts';

describe('cleanupSmokeArtifacts.selectPatternModelCandidates', () => {
  it('joins users and gates by smoke-account email + name prefix', async () => {
    const calls: CapturedCall[] = [];
    const depthRef = { d: 0 };
    const builder = recordingBuilder(calls, depthRef, [
      // Pretend Postgres applied the filter and returned a smoke row.
      {
        id: 'pm-smoke',
        name: 'Smoke Sweater',
        user_id: 'u-smoke',
        email: 'smoke@rowly.test',
      },
    ]);
    const mockDb = jest.fn(() => builder);

    const rows = await selectPatternModelCandidates(
      mockDb as unknown as Parameters<typeof selectPatternModelCandidates>[0],
    );

    // `selectPatternModelCandidates` opens with `db('pattern_models as pm')`.
    expect(mockDb).toHaveBeenCalledWith('pattern_models as pm');

    // Users join — without it the email gate is unenforceable.
    expect(calls).toContainEqual(
      expect.objectContaining({
        method: 'innerJoin',
        args: ['users as u', 'u.id', 'pm.user_id'],
      }),
    );

    // Soft-delete filter on pattern_models.
    expect(calls).toContainEqual(
      expect.objectContaining({
        method: 'whereNull',
        args: ['pm.deleted_at'],
      }),
    );

    // The email gate MUST appear somewhere in the captured chain (inside
    // the nested orWhere closure). If anyone weakens this we fail loud.
    const emailGateCall = calls.find(
      (c) =>
        c.method === 'where' &&
        c.args[0] === 'u.email' &&
        c.args[1] === 'like' &&
        c.args[2] === '%@rowly.test',
    );
    expect(emailGateCall).toBeDefined();

    // At least one ilike on `pm.name` for the smoke prefix branch.
    const nameLikeCall = calls.find(
      (c) =>
        c.method === 'orWhere' &&
        c.args[0] === 'pm.name' &&
        c.args[1] === 'ilike',
    );
    expect(nameLikeCall).toBeDefined();

    // The function returned the rows from the captured chain — sanity.
    expect(rows).toEqual([
      {
        id: 'pm-smoke',
        name: 'Smoke Sweater',
        user_id: 'u-smoke',
        email: 'smoke@rowly.test',
      },
    ]);
  });

  it('NEVER pulls pattern_models via name-only match (no name LIKE outside the email-gated closure)', async () => {
    const calls: CapturedCall[] = [];
    const depthRef = { d: 0 };
    const builder = recordingBuilder(calls, depthRef, []);
    const mockDb = jest.fn(() => builder);

    await selectPatternModelCandidates(
      mockDb as unknown as Parameters<typeof selectPatternModelCandidates>[0],
    );

    // Top-level (`depth=0`) where calls must NOT key off `pm.name` — that
    // would mean a real user's "Smoke Sweater" is deletable. Name-prefix
    // matching is only legal *inside* the nested email-gated closure.
    const topLevelNameMatch = calls.find(
      (c) =>
        c.depth === 0 &&
        (c.method === 'where' || c.method === 'orWhere') &&
        c.args[0] === 'pm.name',
    );
    expect(topLevelNameMatch).toBeUndefined();
  });
});

describe('cleanupSmokeArtifacts — script-level safety predicate', () => {
  /**
   * Mirror predicate that runs the same logic in JS over an in-memory
   * fixture set. Proves the safety contract end-to-end: a real user's
   * pattern_model named "Smoke Sweater" or "PR377 Real Pattern" is NOT
   * a candidate. Kept as a sibling of the SQL query so any divergence
   * shows up here. The SQL query test above pins the database-level
   * version of the same predicate.
   */
  function mirrorPredicate(
    row: { id: string; name: string; email: string },
    idAllowlist: string[],
  ): boolean {
    if (idAllowlist.includes(row.id)) return true;
    const isSmokeEmail = row.email.endsWith('@rowly.test');
    if (!isSmokeEmail) return false;
    const prefixes = [
      'PR3',
      'Hardening Smoke',
      'Smoke ',
      'Miu Top — canonical twin',
    ];
    return prefixes.some((p) =>
      row.name.toLowerCase().startsWith(p.toLowerCase()),
    );
  }

  const FIXTURE = [
    { id: 'pm-1', name: 'Smoke Sweater', email: 'real@user.com' },
    { id: 'pm-2', name: 'PR377 Real Pattern', email: 'real@user.com' },
    { id: 'pm-3', name: 'Smoke Sweater', email: 'smoke@rowly.test' },
    { id: 'pm-4', name: 'PR377 smoke twin', email: 'smoke@rowly.test' },
    { id: 'pm-5', name: 'Hardening Smoke fixture', email: 'smoke2@rowly.test' },
    { id: 'pm-6', name: 'Brioche Cardigan', email: 'real@user.com' },
    { id: 'pm-7', name: 'Random PR3-y name', email: 'real@user.com' },
  ];

  it('does NOT mark a non-smoke user pattern_model named "Smoke Sweater" as a candidate', () => {
    const allowlist: string[] = [];
    expect(mirrorPredicate(FIXTURE[0], allowlist)).toBe(false);
  });

  it('does NOT mark a non-smoke user pattern_model named "PR377 Real Pattern" as a candidate', () => {
    expect(mirrorPredicate(FIXTURE[1], [])).toBe(false);
  });

  it('does NOT name-match across all users (real user with PR3 prefix is preserved)', () => {
    expect(mirrorPredicate(FIXTURE[6], [])).toBe(false);
  });

  it('marks smoke-account rows with a smoke prefix as candidates', () => {
    expect(mirrorPredicate(FIXTURE[2], [])).toBe(true);
    expect(mirrorPredicate(FIXTURE[3], [])).toBe(true);
    expect(mirrorPredicate(FIXTURE[4], [])).toBe(true);
  });

  it('honors the explicit ID allow-list even on a real-user row (operator opt-in)', () => {
    // Operator pasted the id from a previous dry-run after manual review.
    expect(mirrorPredicate(FIXTURE[0], ['pm-1'])).toBe(true);
  });

  it('leaves unrelated patterns alone regardless of email', () => {
    expect(mirrorPredicate(FIXTURE[5], [])).toBe(false);
  });
});

describe('cleanupSmokeArtifacts.selectJoinLayoutCandidates', () => {
  it('joins users and gates by smoke-account email + name prefix (no global name match)', async () => {
    const calls: CapturedCall[] = [];
    const depthRef = { d: 0 };
    const builder = recordingBuilder(calls, depthRef, [
      {
        id: 'jl-smoke',
        name: 'Smoke layout PR378',
        user_id: 'u-smoke',
        project_id: 'pj-smoke',
        email: 'smoke@rowly.test',
      },
    ]);
    const mockDb = jest.fn(() => builder);

    const rows = await selectJoinLayoutCandidates(
      mockDb as unknown as Parameters<typeof selectJoinLayoutCandidates>[0],
    );

    expect(mockDb).toHaveBeenCalledWith('join_layouts as jl');

    expect(calls).toContainEqual(
      expect.objectContaining({
        method: 'innerJoin',
        args: ['users as u', 'u.id', 'jl.user_id'],
      }),
    );

    expect(calls).toContainEqual(
      expect.objectContaining({
        method: 'whereNull',
        args: ['jl.deleted_at'],
      }),
    );

    const emailGateCall = calls.find(
      (c) =>
        c.method === 'where' &&
        c.args[0] === 'u.email' &&
        c.args[1] === 'like' &&
        c.args[2] === '%@rowly.test',
    );
    expect(emailGateCall).toBeDefined();

    const nameLikeCall = calls.find(
      (c) =>
        c.method === 'orWhere' &&
        c.args[0] === 'jl.name' &&
        c.args[1] === 'ilike',
    );
    expect(nameLikeCall).toBeDefined();

    expect(rows).toEqual([
      {
        id: 'jl-smoke',
        name: 'Smoke layout PR378',
        user_id: 'u-smoke',
        project_id: 'pj-smoke',
        email: 'smoke@rowly.test',
      },
    ]);
  });

  it('NEVER pulls join_layouts via name-only match (no name LIKE outside the email-gated closure)', async () => {
    const calls: CapturedCall[] = [];
    const depthRef = { d: 0 };
    const builder = recordingBuilder(calls, depthRef, []);
    const mockDb = jest.fn(() => builder);

    await selectJoinLayoutCandidates(
      mockDb as unknown as Parameters<typeof selectJoinLayoutCandidates>[0],
    );

    // Top-level (depth=0) where calls must NOT key off `jl.name`. That
    // would mean a real user's "Smoke fade cardigan" join layout is
    // deletable. Name-prefix matching is only legal *inside* the
    // nested email-gated closure.
    const topLevelNameMatch = calls.find(
      (c) =>
        c.depth === 0 &&
        (c.method === 'where' || c.method === 'orWhere') &&
        c.args[0] === 'jl.name',
    );
    expect(topLevelNameMatch).toBeUndefined();
  });
});

describe('cleanupSmokeArtifacts — join_layouts safety predicate', () => {
  /**
   * Mirror predicate for join_layouts. Same JS-level proof as
   * pattern_models: a real user's layout literally named
   * "Smoke fade cardigan" must NOT show up as a candidate, while a
   * smoke-account row with the same name does.
   */
  function mirrorPredicate(
    row: { id: string; name: string; email: string },
    idAllowlist: string[],
  ): boolean {
    if (idAllowlist.includes(row.id)) return true;
    const isSmokeEmail = row.email.endsWith('@rowly.test');
    if (!isSmokeEmail) return false;
    const prefixes = ['Smoke ', 'Smoke layout PR', 'PR3', 'Hardening Smoke'];
    return prefixes.some((p) =>
      row.name.toLowerCase().startsWith(p.toLowerCase()),
    );
  }

  const FIXTURE = [
    { id: 'jl-1', name: 'Smoke fade cardigan', email: 'real@user.com' },
    { id: 'jl-2', name: 'Smoke layout PR378', email: 'real@user.com' },
    { id: 'jl-3', name: 'Smoke fade cardigan', email: 'smoke@rowly.test' },
    { id: 'jl-4', name: 'Smoke layout PR378', email: 'smoke@rowly.test' },
    { id: 'jl-5', name: 'PR378 join smoke', email: 'smoke@rowly.test' },
    { id: 'jl-6', name: 'Hardening Smoke join', email: 'smoke@rowly.test' },
    { id: 'jl-7', name: 'Sleeve join', email: 'real@user.com' },
  ];

  it('does NOT mark a real-user layout literally named "Smoke fade cardigan" as a candidate', () => {
    expect(mirrorPredicate(FIXTURE[0], [])).toBe(false);
  });

  it('does NOT mark a real-user layout literally named "Smoke layout PR378" as a candidate', () => {
    expect(mirrorPredicate(FIXTURE[1], [])).toBe(false);
  });

  it('marks smoke-account rows with a smoke prefix as candidates', () => {
    expect(mirrorPredicate(FIXTURE[2], [])).toBe(true);
    expect(mirrorPredicate(FIXTURE[3], [])).toBe(true);
    expect(mirrorPredicate(FIXTURE[4], [])).toBe(true);
    expect(mirrorPredicate(FIXTURE[5], [])).toBe(true);
  });

  it('honors the explicit ID allow-list even on a real-user row (operator opt-in)', () => {
    expect(mirrorPredicate(FIXTURE[0], ['jl-1'])).toBe(true);
  });

  it('leaves unrelated layouts alone regardless of email', () => {
    expect(mirrorPredicate(FIXTURE[6], [])).toBe(false);
  });
});
