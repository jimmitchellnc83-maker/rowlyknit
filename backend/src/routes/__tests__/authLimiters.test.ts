/**
 * Auth + Launch Polish Sprint — register/login/reset rate-limiter contract.
 *
 * Three pins:
 *
 *   1. Successful registrations COUNT against the register limiter
 *      (`skipSuccessfulRequests` is OFF). Otherwise a bot can mint
 *      unlimited accounts.
 *
 *   2. Successful logins do NOT count against the login limiter
 *      (`skipSuccessfulRequests` stays ON). A real knitter logging in
 *      and out repeatedly never gets locked out.
 *
 *   3. The password-reset throttle is now composite: per-IP AND
 *      per-email. Same IP across many emails throttles; same email
 *      across many IPs throttles.
 *
 * The DB layer is mocked — these tests are about middleware behavior,
 * not the controllers themselves. Redis is replaced with an in-process
 * MemoryStore (same pattern as `sharedChartAccessLimiter.test.ts`) so
 * the limiter math runs without a live Redis.
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const usersWhereFirst = jest.fn();
const usersInsertReturning = jest.fn();
const usersUpdate = jest.fn().mockResolvedValue(1);
const auditLogInsert = jest.fn().mockResolvedValue([{ id: 'audit-1' }]);

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    if (table === 'users') {
      return {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: usersWhereFirst,
        insert: jest.fn().mockReturnValue({
          returning: usersInsertReturning,
        }),
        update: usersUpdate,
      };
    }
    if (table === 'audit_logs') {
      return {
        insert: auditLogInsert,
      };
    }
    if (table === 'sessions') {
      return {
        where: jest.fn().mockReturnThis(),
        first: jest.fn().mockResolvedValue(null),
        insert: jest.fn().mockReturnValue({
          returning: jest.fn().mockResolvedValue([{ id: 'session-1' }]),
        }),
        update: jest.fn().mockResolvedValue(1),
      };
    }
    return {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(0),
    };
  });
  dbFn.raw = jest.fn((s: string) => s);
  dbFn.fn = { now: jest.fn(() => new Date()) };
  return { default: dbFn, __esModule: true };
});

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Replace the redis-backed RedisStore with a tiny in-memory Store —
// same trick used in sharedChartAccessLimiter.test.ts. The limiter math
// is what we're locking; Redis is incidental.
jest.mock('rate-limit-redis', () => {
  class InMemoryStore {
    windowMs = 0;
    hits: Map<string, { count: number; resetTime: Date }> = new Map();
    init(options: { windowMs: number }) {
      this.windowMs = options.windowMs;
    }
    async increment(key: string) {
      const now = Date.now();
      const existing = this.hits.get(key);
      if (!existing || existing.resetTime.getTime() < now) {
        const resetTime = new Date(now + this.windowMs);
        this.hits.set(key, { count: 1, resetTime });
        return { totalHits: 1, resetTime };
      }
      existing.count += 1;
      return { totalHits: existing.count, resetTime: existing.resetTime };
    }
    async decrement(key: string) {
      const existing = this.hits.get(key);
      if (existing && existing.count > 0) existing.count -= 1;
    }
    async resetKey(key: string) {
      this.hits.delete(key);
    }
    async resetAll() {
      this.hits.clear();
    }
  }
  return {
    __esModule: true,
    default: InMemoryStore,
    RedisStore: InMemoryStore,
  };
});

jest.mock('../../config/redis', () => ({
  redisClient: { call: jest.fn().mockResolvedValue(0) },
  __esModule: true,
}));

// Welcome / reset email sends are async fire-and-forget; never let them
// hit the real emailService and try to network out.
jest.mock('../../services/emailService', () => ({
  __esModule: true,
  default: {
    sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../services/seedExampleData', () => ({
  __esModule: true,
  seedExampleDataForUser: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../middleware/originCheck', () => ({
  __esModule: true,
  requireSameOrigin: (_req: any, _res: any, next: any) => next(),
}));

process.env.JWT_SECRET = 'test-jwt-secret-auth-limiters-32chars-min';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-auth-limiters-32c';
process.env.APP_URL = 'http://localhost:3000';
// Tighten the limits for fast tests. Routes read these at module init.
process.env.LOGIN_RATE_LIMIT_MAX = '3';
process.env.REGISTER_RATE_LIMIT_MAX = '3';
process.env.PASSWORD_RESET_IP_RATE_LIMIT_MAX = '3';
process.env.PASSWORD_RESET_EMAIL_RATE_LIMIT_MAX = '2';

// IMPORTANT: mocks above must run before importing the route — the
// route's middleware chain is built at module load time.
import authRoutes from '../auth';

function buildApp() {
  const app = express();
  app.set('trust proxy', false);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  // Error handler — the controllers throw `ValidationError` etc which
  // need to surface as JSON 4xx for the limiter assertions to be
  // unambiguous (otherwise the default Express handler returns the
  // stack as HTML and supertest sees status 500).
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  });
  return app;
}

beforeEach(() => {
  usersWhereFirst.mockReset();
  usersInsertReturning.mockReset();
  usersUpdate.mockClear();
  auditLogInsert.mockClear();
});

describe('POST /api/auth/register — register limiter counts successful requests', () => {
  it('throttles a 4th register attempt even when prior 3 succeeded (skipSuccessfulRequests is OFF)', async () => {
    // No existing user; insert returns a row each time.
    usersWhereFirst.mockResolvedValue(null);
    usersInsertReturning.mockResolvedValue([
      {
        id: 'user-1',
        email: 'a@rowly.test',
        first_name: 'A',
        last_name: 'B',
        created_at: new Date(),
      },
    ]);

    const app = buildApp();

    // 3 successful registrations, all 201.
    for (let i = 0; i < 3; i += 1) {
      const r = await request(app)
        .post('/api/auth/register')
        .send({
          email: `user${i}@rowly.test`,
          password: 'StrongP@ss1!',
          firstName: 'F',
          lastName: 'L',
        });
      expect(r.status).toBe(201);
    }

    // The 4th must be 429 even though a real account WOULD have been
    // created — that's the whole point of counting successful registers.
    const throttled = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'user-extra@rowly.test',
        password: 'StrongP@ss1!',
        firstName: 'F',
        lastName: 'L',
      });
    expect(throttled.status).toBe(429);
  });
});

describe('POST /api/auth/login — login limiter still skips successful logins', () => {
  it('does not count successful logins, so a knitter logging in/out repeatedly is not locked out', async () => {
    // Stub a valid user. Bcrypt comparePassword is real but the hash
    // here was generated for the test password.
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('StrongP@ss1!', 4);
    usersWhereFirst.mockResolvedValue({
      id: 'user-login-1',
      email: 'login@rowly.test',
      password_hash: hash,
      is_active: true,
      first_name: 'L',
      last_name: 'I',
      email_verified: true,
      preferences: {},
    });

    const app = buildApp();

    // Run 5 successful logins — well over the 3-cap. None should 429
    // because skipSuccessfulRequests=true on the login limiter.
    for (let i = 0; i < 5; i += 1) {
      const r = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@rowly.test', password: 'StrongP@ss1!' });
      expect(r.status).toBe(200);
    }
  });

  it('does throttle on the (max+1)th failed login attempt', async () => {
    // Wrong password every time — comparePassword returns false.
    const bcrypt = require('bcrypt');
    const hash = await bcrypt.hash('CorrectP@ss1!', 4);
    usersWhereFirst.mockResolvedValue({
      id: 'user-login-fail',
      email: 'fail@rowly.test',
      password_hash: hash,
      is_active: true,
      first_name: 'L',
      last_name: 'I',
      email_verified: true,
      preferences: {},
    });

    const app = buildApp();
    for (let i = 0; i < 3; i += 1) {
      const r = await request(app)
        .post('/api/auth/login')
        .send({ email: 'fail@rowly.test', password: 'wrong' });
      expect(r.status).toBe(401);
    }
    const throttled = await request(app)
      .post('/api/auth/login')
      .send({ email: 'fail@rowly.test', password: 'wrong' });
    expect(throttled.status).toBe(429);
  });
});

describe('POST /api/auth/request-password-reset — composite IP + email limiter', () => {
  it('throttles same IP across many distinct emails (per-IP gate fires)', async () => {
    // No user found — controller still 200s for enumeration safety.
    usersWhereFirst.mockResolvedValue(null);

    const app = buildApp();

    // PASSWORD_RESET_IP_RATE_LIMIT_MAX=3, distinct emails each request.
    for (let i = 0; i < 3; i += 1) {
      const r = await request(app)
        .post('/api/auth/request-password-reset')
        .send({ email: `target${i}@rowly.test` });
      expect(r.status).toBe(200);
    }

    const sprayed = await request(app)
      .post('/api/auth/request-password-reset')
      .send({ email: 'target-extra@rowly.test' });
    expect(sprayed.status).toBe(429);
  });

  it('throttles same email across changing IPs (per-email gate fires)', async () => {
    usersWhereFirst.mockResolvedValue(null);
    const app = buildApp();

    // PASSWORD_RESET_EMAIL_RATE_LIMIT_MAX=2. Vary X-Forwarded-For so the
    // per-IP bucket is fresh on each request and the per-email gate is
    // the one that ends up firing. We have to trust the proxy header —
    // tell express to do that for this test.
    app.set('trust proxy', true);

    const target = 'lockable@rowly.test';
    for (let i = 0; i < 2; i += 1) {
      const r = await request(app)
        .post('/api/auth/request-password-reset')
        .set('X-Forwarded-For', `10.0.0.${100 + i}`)
        .send({ email: target });
      expect(r.status).toBe(200);
    }

    const throttled = await request(app)
      .post('/api/auth/request-password-reset')
      .set('X-Forwarded-For', '10.0.0.250')
      .send({ email: target });
    expect(throttled.status).toBe(429);
  });
});
