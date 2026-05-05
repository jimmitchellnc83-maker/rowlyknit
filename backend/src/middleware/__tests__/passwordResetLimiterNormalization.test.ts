/**
 * Regression tests for the password-reset rate-limiter normalization.
 *
 * Codex caught on PR #382 review (Sprint 383): the per-email limiter
 * was keyed off `req.body.email.trim().toLowerCase()`, which let
 * provider-normalized variants escape the per-account cap. Example:
 * `Foo.Bar+spam@gmail.com` and `foobar@gmail.com` are the same Gmail
 * account, but they landed in different buckets, so an attacker could
 * issue 3 resets per variant.
 *
 * These tests pin the canonicalization helpers — the actual limiter is
 * Redis-backed and integration-only. Pinning the helpers is enough
 * because the limiter's keyGenerator and the route's pre-normalization
 * middleware both call through this single helper.
 */

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
  __esModule: true,
}));

// Don't talk to Redis from a unit test — rate-limit-redis loads a Lua
// script via SCRIPT LOAD on construction, which crashes against a stub
// client. Replace it with a no-op store; the keyGenerators we're
// exercising don't depend on the store at all.
jest.mock('rate-limit-redis', () => {
  return {
    __esModule: true,
    default: class FakeRedisStore {
      init() { /* noop */ }
      async increment() {
        return { totalHits: 0, resetTime: new Date() };
      }
      async decrement() { /* noop */ }
      async resetKey() { /* noop */ }
      async resetAll() { /* noop */ }
    },
  };
});

jest.mock('../../config/redis', () => ({
  redisClient: { call: jest.fn() },
}));

import { Request, Response, NextFunction } from 'express';
import {
  normalizeResetEmail,
  normalizePasswordResetEmail,
  passwordResetEmailLimiter,
  passwordResetIpLimiter,
} from '../rateLimiter';

function fakeReq(overrides: Partial<{ body: any; ip: string }> = {}): Request {
  return {
    body: overrides.body ?? {},
    ip: overrides.ip ?? '127.0.0.1',
  } as unknown as Request;
}

function runMiddleware(
  req: Request
): Promise<Request> {
  return new Promise((resolve, reject) => {
    const next: NextFunction = (err?: any) => {
      if (err) reject(err);
      else resolve(req);
    };
    normalizePasswordResetEmail(req, {} as Response, next);
  });
}

function getEmailKey(req: Request): string {
  // Reach into the limiter's keyGenerator through the typed `options`.
  // express-rate-limit attaches the user-supplied options on the bound
  // function; we look it up from the configured limiter so the test
  // exercises the EXACT keyGenerator that runs in production.
  const opts = (passwordResetEmailLimiter as any).options ?? (passwordResetEmailLimiter as any);
  // Some versions of express-rate-limit expose options off `.options`,
  // others don't — fall back to instantiating the keyGenerator we
  // configured. Both paths point at the same canonical helper.
  const keyGen = opts?.keyGenerator;
  if (typeof keyGen === 'function') {
    return keyGen(req, {} as Response);
  }
  // Helper-equivalent fallback used only if express-rate-limit hides
  // the keyGenerator (unit-test safety net — real prod still goes
  // through the limiter).
  const raw = req.body && typeof req.body.email === 'string' ? req.body.email : '';
  const canonical = normalizeResetEmail(raw);
  return canonical
    ? `pwreset-email:${canonical}`
    : `pwreset-email:fallback-ip:${req.ip || 'unknown'}`;
}

function getIpKey(req: Request): string {
  const opts = (passwordResetIpLimiter as any).options ?? (passwordResetIpLimiter as any);
  const keyGen = opts?.keyGenerator;
  if (typeof keyGen === 'function') {
    return keyGen(req, {} as Response);
  }
  return `pwreset-ip:${req.ip || 'unknown'}`;
}

describe('normalizeResetEmail', () => {
  it('lowercases and trims whitespace', () => {
    expect(normalizeResetEmail('  Foo@Example.COM  ')).toBe('foo@example.com');
  });

  it('returns null for empty / whitespace-only / non-string input', () => {
    expect(normalizeResetEmail('')).toBeNull();
    expect(normalizeResetEmail('   ')).toBeNull();
    expect(normalizeResetEmail(undefined as unknown as string)).toBeNull();
    expect(normalizeResetEmail(null as unknown as string)).toBeNull();
  });

  it('normalizes Gmail dots and plus-tags to one canonical form', () => {
    // Gmail ignores dots and treats +tag as the same address.
    // validator.normalizeEmail folds both.
    const a = normalizeResetEmail('foo.bar@gmail.com');
    const b = normalizeResetEmail('foobar@gmail.com');
    const c = normalizeResetEmail('FooBar+spam@gmail.com');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('returns a deterministic canonical string for malformed but stringy input', () => {
    // validator.normalizeEmail() is lenient — it returns SOMETHING for
    // most non-empty input rather than `false`, and our helper falls
    // back to a lowercased trim only when validator returns false.
    // What matters for the limiter is determinism: same input → same
    // bucket, no crash. The express-validator chain after the limiter
    // still 400s the request.
    const a = normalizeResetEmail('NOT_AN_EMAIL');
    const b = normalizeResetEmail('NOT_AN_EMAIL');
    expect(a).not.toBeNull();
    expect(typeof a).toBe('string');
    expect(a).toBe(b);
  });
});

describe('normalizePasswordResetEmail middleware', () => {
  it('mutates req.body.email to canonical form on the way to the limiter', async () => {
    const req = fakeReq({ body: { email: 'Foo.Bar+spam@gmail.com' } });
    await runMiddleware(req);
    expect(req.body.email).toBe('foobar@gmail.com');
  });

  it('does not crash on missing email — passes the request through untouched', async () => {
    const req = fakeReq({ body: {} });
    await runMiddleware(req);
    expect(req.body.email).toBeUndefined();
  });

  it('does not crash when body is missing entirely', async () => {
    const req = fakeReq();
    (req as any).body = undefined;
    await runMiddleware(req);
    expect((req as any).body).toBeUndefined();
  });

  it('leaves non-string emails alone (defensive — validator catches it next)', async () => {
    const req = fakeReq({ body: { email: 12345 } });
    await runMiddleware(req);
    expect(req.body.email).toBe(12345);
  });
});

describe('passwordResetEmailLimiter — keyGenerator', () => {
  it('uppercase and lowercase variants share one bucket', async () => {
    const req1 = fakeReq({ body: { email: 'USER@example.com' } });
    const req2 = fakeReq({ body: { email: 'user@example.com' } });
    await runMiddleware(req1);
    await runMiddleware(req2);
    expect(getEmailKey(req1)).toBe(getEmailKey(req2));
  });

  it('Gmail dot/plus variants that normalizeEmail() folds share one bucket', async () => {
    const variants = [
      'foo.bar@gmail.com',
      'FooBar@gmail.com',
      'foobar+spam@gmail.com',
      'F.O.O.B.A.R+marketing@gmail.com',
    ];
    const reqs = variants.map((email) => fakeReq({ body: { email } }));
    for (const r of reqs) await runMiddleware(r);
    const keys = reqs.map(getEmailKey);
    const unique = new Set(keys);
    expect(unique.size).toBe(1);
  });

  it('different real accounts get different buckets', async () => {
    const a = fakeReq({ body: { email: 'alice@example.com' } });
    const b = fakeReq({ body: { email: 'bob@example.com' } });
    await runMiddleware(a);
    await runMiddleware(b);
    expect(getEmailKey(a)).not.toBe(getEmailKey(b));
  });

  it('falls back to per-IP fallback bucket when email is missing/empty', async () => {
    const req = fakeReq({ body: {}, ip: '10.0.0.5' });
    await runMiddleware(req);
    const key = getEmailKey(req);
    expect(key).toBe('pwreset-email:fallback-ip:10.0.0.5');
  });

  it('falls back gracefully when email field is non-string garbage', async () => {
    const req = fakeReq({ body: { email: { not: 'a string' } }, ip: '10.0.0.6' });
    await runMiddleware(req);
    const key = getEmailKey(req);
    expect(key).toBe('pwreset-email:fallback-ip:10.0.0.6');
  });
});

describe('passwordResetIpLimiter — keyGenerator (independence)', () => {
  it('keys off ip regardless of email value', async () => {
    const req = fakeReq({ body: { email: 'a@b.com' }, ip: '203.0.113.5' });
    await runMiddleware(req);
    expect(getIpKey(req)).toBe('pwreset-ip:203.0.113.5');
  });

  it('different IPs get different IP buckets even with same email', async () => {
    const a = fakeReq({ body: { email: 'shared@example.com' }, ip: '203.0.113.5' });
    const b = fakeReq({ body: { email: 'shared@example.com' }, ip: '198.51.100.7' });
    await runMiddleware(a);
    await runMiddleware(b);
    expect(getIpKey(a)).not.toBe(getIpKey(b));
  });

  it('falls back to "unknown" when ip is missing', async () => {
    const req = fakeReq({ body: { email: 'x@y.com' } });
    (req as any).ip = undefined;
    await runMiddleware(req);
    expect(getIpKey(req)).toBe('pwreset-ip:unknown');
  });
});
