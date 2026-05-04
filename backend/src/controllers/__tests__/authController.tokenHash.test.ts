/**
 * Auth + Security Hardening Sprint — refresh + reset tokens are stored
 * as SHA-256 hashes, never raw. This suite mocks the db module and
 * proves four invariants on the controller surface:
 *
 *   1. login (issueSession) writes `refresh_token_hash`, NOT a raw
 *      `refresh_token` column.
 *   2. refresh looks the session up by `refresh_token_hash` of the
 *      submitted token.
 *   3. logout revokes by hash, never by raw value.
 *   4. requestPasswordReset writes `reset_password_token_hash` (and
 *      the response is identical regardless of whether the email
 *      exists, so enumeration stays blocked).
 *   5. resetPassword looks up by hash, clears the hash on use, and
 *      throws on token reuse.
 */

// Intentionally low-entropy literals so gitleaks's generic-api-key rule
// (entropy ≥ 3.5) does not flag this Jest fixture. validateEnv only checks
// that the values are ≥32 chars and that the two secrets differ.
process.env.JWT_SECRET = 'a'.repeat(40);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);
process.env.NODE_ENV = 'test';

import { hashToken } from '../../utils/tokenHash';

interface ChainCall {
  table?: string;
  method: string;
  args: unknown[];
}

const captured: ChainCall[] = [];

// Per-table fixtures the chain mock walks through. The chain proxy
// records every call and returns hand-written terminal results when
// `.first()` / `.update()` / `.insert(...).returning(...)` is hit.
const usersFirst = jest.fn();
const usersUpdate = jest.fn();
const sessionsFirst = jest.fn();
const sessionsUpdate = jest.fn();
const sessionsInsertReturning = jest.fn();

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    function chain(): any {
      const handler: ProxyHandler<object> = {
        get(_t, prop) {
          const name = String(prop);
          return (...args: unknown[]) => {
            captured.push({ table, method: name, args });
            if (name === 'first') {
              if (table === 'users') return usersFirst();
              if (table === 'sessions') return sessionsFirst();
              return Promise.resolve(null);
            }
            if (name === 'update') {
              if (table === 'users') return usersUpdate(...args);
              if (table === 'sessions') return sessionsUpdate(...args);
              return Promise.resolve(0);
            }
            if (name === 'insert') {
              return {
                returning: (..._cols: unknown[]) => {
                  if (table === 'sessions') return sessionsInsertReturning();
                  return Promise.resolve([]);
                },
              };
            }
            return new Proxy({}, handler);
          };
        },
      };
      return new Proxy({}, handler);
    }
    return chain();
  });
  return { default: dbFn, __esModule: true };
});

jest.mock('../../middleware/auditLog', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/tokenRevocation', () => ({
  revokeAccessTokenJti: jest.fn().mockResolvedValue(undefined),
  revokeAllUserTokensBefore: jest.fn().mockResolvedValue(undefined),
}));

const sendPasswordResetEmail = jest.fn().mockResolvedValue(undefined);
const sendWelcomeEmail = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/emailService', () => ({
  __esModule: true,
  default: {
    sendPasswordResetEmail: (...a: unknown[]) => sendPasswordResetEmail(...a),
    sendWelcomeEmail: (...a: unknown[]) => sendWelcomeEmail(...a),
  },
}));

jest.mock('../../services/seedExampleData', () => ({
  seedExampleDataForUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import {
  login,
  logout,
  refreshToken as refreshTokenHandler,
  requestPasswordReset,
  resetPassword,
} from '../authController';
import { generateRefreshToken } from '../../utils/jwt';
import { hashPassword } from '../../utils/password';

function makeReq(overrides: Record<string, unknown> = {}): any {
  return {
    body: {},
    cookies: {},
    headers: {},
    ip: '1.2.3.4',
    user: undefined,
    ...overrides,
  };
}

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => {
  captured.length = 0;
  jest.clearAllMocks();
});

describe('login → issueSession stores refresh_token_hash, not raw', () => {
  it('inserts the session with refresh_token_hash null and updates the hash post-issue', async () => {
    const passwordHash = await hashPassword('StrongP@ss1!');
    usersFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'a@example.com',
      password_hash: passwordHash,
      first_name: 'A',
      last_name: 'User',
      is_active: true,
      email_verified: true,
      preferences: {},
    });
    sessionsInsertReturning.mockResolvedValueOnce([
      { id: 'session-1', user_id: 'user-1' },
    ]);
    sessionsUpdate.mockResolvedValueOnce(1);
    usersUpdate.mockResolvedValueOnce(1);

    const res = makeRes();
    await login(
      makeReq({ body: { email: 'a@example.com', password: 'StrongP@ss1!' } }),
      res,
    );

    const inserts = captured.filter(
      (c) => c.table === 'sessions' && c.method === 'insert',
    );
    expect(inserts).toHaveLength(1);
    const insertedRow = inserts[0].args[0] as Record<string, unknown>;
    expect('refresh_token' in insertedRow).toBe(false);
    expect(insertedRow.refresh_token_hash).toBeNull();

    const sessionUpdates = captured.filter(
      (c) => c.table === 'sessions' && c.method === 'update',
    );
    const hashUpdate = sessionUpdates.find((c) => {
      const payload = c.args[0] as Record<string, unknown>;
      return (
        typeof payload?.refresh_token_hash === 'string' &&
        (payload.refresh_token_hash as string).length === 64
      );
    });
    expect(hashUpdate).toBeDefined();

    // The response carries the raw refresh token; the DB only ever sees the hash.
    expect(res.json).toHaveBeenCalled();
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.data.refreshToken).toEqual(expect.any(String));
    const writtenHash = (
      hashUpdate!.args[0] as { refresh_token_hash: string }
    ).refresh_token_hash;
    expect(writtenHash).toBe(hashToken(body.data.refreshToken));

    // No call site should ever read a `refresh_token` column anywhere.
    const rawColumnUse = captured.find((c) => {
      const payload = c.args[0];
      return (
        payload !== null &&
        typeof payload === 'object' &&
        'refresh_token' in (payload as Record<string, unknown>)
      );
    });
    expect(rawColumnUse).toBeUndefined();
  });
});

describe('refreshToken handler — looks up session by hash, never raw', () => {
  it('issues a new access token when the hash matches an active session', async () => {
    const token = generateRefreshToken({
      userId: 'user-1',
      sessionId: 'session-1',
    });
    sessionsFirst.mockResolvedValueOnce({
      id: 'session-1',
      user_id: 'user-1',
      is_revoked: false,
      expires_at: new Date(Date.now() + 60_000),
    });
    usersFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'a@example.com',
      is_active: true,
    });

    const res = makeRes();
    await refreshTokenHandler(
      makeReq({ body: { refreshToken: token } }),
      res,
    );

    // Exactly one .where(...) on sessions must reference the hash.
    const sessionWheres = captured.filter(
      (c) => c.table === 'sessions' && c.method === 'where',
    );
    const byHash = sessionWheres.find((c) => {
      const payload = c.args[0] as Record<string, unknown>;
      return (
        payload?.refresh_token_hash === hashToken(token) &&
        payload?.is_revoked === false
      );
    });
    expect(byHash).toBeDefined();

    // …and there is no .where on raw `refresh_token`.
    const byRaw = sessionWheres.find((c) => {
      const payload = c.args[0];
      return (
        payload !== null &&
        typeof payload === 'object' &&
        'refresh_token' in (payload as Record<string, unknown>)
      );
    });
    expect(byRaw).toBeUndefined();

    expect(res.json).toHaveBeenCalled();
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.accessToken).toEqual(expect.any(String));
  });

  it('rejects when no session row matches the submitted-token hash', async () => {
    const token = generateRefreshToken({
      userId: 'user-1',
      sessionId: 'session-1',
    });
    sessionsFirst.mockResolvedValueOnce(undefined);

    const res = makeRes();
    await expect(
      refreshTokenHandler(makeReq({ body: { refreshToken: token } }), res),
    ).rejects.toThrow(/Invalid or expired refresh token/i);
  });
});

describe('logout — revokes by hash', () => {
  it('updates the session row keyed on refresh_token_hash, not raw', async () => {
    const token = generateRefreshToken({
      userId: 'user-1',
      sessionId: 'session-1',
    });
    sessionsUpdate.mockResolvedValueOnce(1);

    const res = makeRes();
    await logout(
      makeReq({
        cookies: { refreshToken: token },
        user: { userId: 'user-1' },
      }),
      res,
    );

    const sessionWheres = captured.filter(
      (c) => c.table === 'sessions' && c.method === 'where',
    );
    const byHash = sessionWheres.find((c) => {
      const payload = c.args[0] as Record<string, unknown>;
      return payload?.refresh_token_hash === hashToken(token);
    });
    expect(byHash).toBeDefined();

    const byRaw = sessionWheres.find((c) => {
      const payload = c.args[0];
      return (
        payload !== null &&
        typeof payload === 'object' &&
        'refresh_token' in (payload as Record<string, unknown>)
      );
    });
    expect(byRaw).toBeUndefined();

    expect(res.json).toHaveBeenCalled();
  });
});

describe('requestPasswordReset — stores hash, leaks no enumeration', () => {
  it('writes reset_password_token_hash for a real user and returns the generic 200', async () => {
    usersFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'a@example.com',
      first_name: 'A',
    });
    usersUpdate.mockResolvedValueOnce(1);

    const res = makeRes();
    await requestPasswordReset(
      makeReq({ body: { email: 'a@example.com' } }),
      res,
    );

    const userUpdates = captured.filter(
      (c) => c.table === 'users' && c.method === 'update',
    );
    const hashUpdate = userUpdates.find((c) => {
      const payload = c.args[0] as Record<string, unknown>;
      return (
        typeof payload?.reset_password_token_hash === 'string' &&
        (payload.reset_password_token_hash as string).length === 64
      );
    });
    expect(hashUpdate).toBeDefined();

    // The raw column does not appear anywhere.
    const rawWrite = userUpdates.find((c) => {
      const payload = c.args[0];
      return (
        payload !== null &&
        typeof payload === 'object' &&
        'reset_password_token' in (payload as Record<string, unknown>)
      );
    });
    expect(rawWrite).toBeUndefined();

    // Generic response — no leak of the email's existence.
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/If an account exists/);

    // Email was actually attempted (exists path).
    expect(sendPasswordResetEmail).toHaveBeenCalled();
  });

  it('returns the same generic 200 when the email is unknown — no DB write', async () => {
    usersFirst.mockResolvedValueOnce(undefined);

    const res = makeRes();
    await requestPasswordReset(
      makeReq({ body: { email: 'nobody@example.com' } }),
      res,
    );

    expect(usersUpdate).not.toHaveBeenCalled();
    expect(sendPasswordResetEmail).not.toHaveBeenCalled();

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/If an account exists/);
  });
});

describe('resetPassword — hash lookup, expiry, single-use', () => {
  const RAW_TOKEN = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeeebbbbbbbb-cccc-dddd-eeee-ffffffffffff';

  it('resets and clears the hash on successful redemption', async () => {
    usersFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'a@example.com',
      reset_password_token_hash: hashToken(RAW_TOKEN),
      reset_password_expires: new Date(Date.now() + 60_000),
    });
    usersUpdate.mockResolvedValueOnce(1);

    const res = makeRes();
    await resetPassword(
      makeReq({ body: { token: RAW_TOKEN, password: 'StrongP@ss1!' } }),
      res,
    );

    // Lookup keyed on hash, never on raw.
    const userWheres = captured.filter(
      (c) => c.table === 'users' && c.method === 'where',
    );
    const byHash = userWheres.find((c) => {
      const payload = c.args[0] as Record<string, unknown>;
      return payload?.reset_password_token_hash === hashToken(RAW_TOKEN);
    });
    expect(byHash).toBeDefined();
    const byRaw = userWheres.find((c) => {
      const payload = c.args[0];
      return (
        payload !== null &&
        typeof payload === 'object' &&
        'reset_password_token' in (payload as Record<string, unknown>)
      );
    });
    expect(byRaw).toBeUndefined();

    // Hash cleared on successful redemption — single-use enforcement.
    const updates = captured.filter(
      (c) => c.table === 'users' && c.method === 'update',
    );
    const clearing = updates.find((c) => {
      const payload = c.args[0] as Record<string, unknown>;
      return (
        payload?.reset_password_token_hash === null &&
        payload?.reset_password_expires === null &&
        typeof payload?.password_hash === 'string'
      );
    });
    expect(clearing).toBeDefined();

    expect(res.json).toHaveBeenCalled();
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.success).toBe(true);
  });

  it('rejects an expired/unknown token (no row found)', async () => {
    usersFirst.mockResolvedValueOnce(undefined);
    const res = makeRes();
    await expect(
      resetPassword(
        makeReq({ body: { token: RAW_TOKEN, password: 'StrongP@ss1!' } }),
        res,
      ),
    ).rejects.toThrow(/Invalid or expired reset token/i);
  });

  it('rejects a reused token (hash already cleared)', async () => {
    // First call: token is valid, hash exists.
    usersFirst.mockResolvedValueOnce({
      id: 'user-1',
      email: 'a@example.com',
      reset_password_token_hash: hashToken(RAW_TOKEN),
      reset_password_expires: new Date(Date.now() + 60_000),
    });
    usersUpdate.mockResolvedValueOnce(1);
    await resetPassword(
      makeReq({ body: { token: RAW_TOKEN, password: 'StrongP@ss1!' } }),
      makeRes(),
    );

    // Second call with the same raw token: the hash was cleared on the
    // first redemption, so the WHERE-by-hash returns no row.
    usersFirst.mockResolvedValueOnce(undefined);
    const res2 = makeRes();
    await expect(
      resetPassword(
        makeReq({ body: { token: RAW_TOKEN, password: 'StrongP@ss1!' } }),
        res2,
      ),
    ).rejects.toThrow(/Invalid or expired reset token/i);
  });
});
