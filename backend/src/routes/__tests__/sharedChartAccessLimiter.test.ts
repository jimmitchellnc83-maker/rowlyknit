/**
 * Final Polish Sprint 1, audit follow-up — verifies the dedicated
 * password-attempt limiter on POST /shared/chart/:token/access. The
 * shared `publicSharedLimiter` (60/min/IP) is too lax for a password
 * gate; this test pins the stricter (ip, token) limiter so future
 * refactors can't silently weaken it.
 *
 * The DB layer is mocked so wrong-password responses come back as 401
 * without ever hitting Postgres. Redis is replaced with an in-process
 * MemoryStore — the production limiter still uses Redis, but for the
 * limit math under test that's an implementation detail.
 */

import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import bcrypt from 'bcrypt';

const sharedChartsFirst = jest.fn();
const sharedChartsUpdate = jest.fn().mockResolvedValue(1);
const chartsFirst = jest.fn();

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    if (table === 'shared_charts') {
      return {
        where: jest.fn().mockReturnThis(),
        first: sharedChartsFirst,
        update: sharedChartsUpdate,
      };
    }
    if (table === 'charts') {
      return {
        where: jest.fn().mockReturnThis(),
        first: chartsFirst,
      };
    }
    return { where: jest.fn().mockReturnThis(), first: jest.fn() };
  });
  dbFn.raw = jest.fn((s: string) => s);
  dbFn.fn = { now: jest.fn(() => new Date()) };
  return { default: dbFn, __esModule: true };
});

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Replace the redis-backed RedisStore with a tiny in-memory Store that
// satisfies express-rate-limit's Store interface. We keep the real
// counter behavior — that's what the tests assert on — but skip the
// actual Redis round-trip. The class is declared inside the mock factory
// to avoid jest hoisting complaints about referencing out-of-scope vars.
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

jest.mock('../../services/chartExportService', () => ({
  exportChart: jest.fn().mockResolvedValue({
    buffer: Buffer.from('%PDF-fake'),
    mimeType: 'application/pdf',
    extension: 'pdf',
  }),
  __esModule: true,
}));

process.env.JWT_SECRET = 'test-jwt-secret-share-access-limiter';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-share-access-limiter';
// Lower the cap so the test doesn't need to mash 11 requests through
// every assertion. The route reads this at module-init time.
process.env.SHARE_PASSWORD_RATE_LIMIT_MAX = '3';

// IMPORTANT: mocks above must be set before importing the route — the
// route imports the limiter at module load and the limiter binds its
// max + store at construction time.
import sharedRoutes from '../shared';

function buildApp() {
  const app = express();
  // express-rate-limit reads req.ip via the trust-proxy chain. In tests
  // we don't need that; just disable the IP-validation guard so it
  // doesn't warn about the default trust-proxy setting.
  app.set('trust proxy', false);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/shared', sharedRoutes);
  return app;
}

const TOKEN_PROTECTED = 'protected-token-limiter-test';
const TOKEN_PUBLIC = 'public-token-limiter-test';
const PASSWORD = 'CorrectHorse9!';

const PUBLIC_SHARE = {
  id: 'share-public',
  share_token: TOKEN_PUBLIC,
  chart_id: 'chart-public',
  password_hash: null,
  expires_at: null,
  allow_copy: false,
  allow_download: true,
  visibility: 'public',
};

const CHART_PUBLIC = {
  id: 'chart-public',
  name: 'Demo Public',
  grid: [['k']],
  rows: 1,
  columns: 1,
  symbol_legend: { k: 'knit' },
  description: '',
};

async function makeProtectedShare() {
  const hash = await bcrypt.hash(PASSWORD, 4);
  return {
    id: 'share-protected',
    share_token: TOKEN_PROTECTED,
    chart_id: 'chart-protected',
    password_hash: hash,
    expires_at: null,
    allow_copy: false,
    allow_download: true,
    visibility: 'public',
  };
}

beforeEach(() => {
  // mockReset (not just clearAllMocks) is required here because
  // mockResolvedValueOnce queues survive clearAllMocks. Without this,
  // shares queued by test N leak into test N+1 and confuse the GET-view
  // assertion.
  sharedChartsFirst.mockReset();
  sharedChartsUpdate.mockReset();
  sharedChartsUpdate.mockResolvedValue(1);
  chartsFirst.mockReset();
});

describe('POST /shared/chart/:token/access — strict per-(ip,token) limiter', () => {
  it('blocks the (max+1)th wrong-password attempt with 429', async () => {
    // Five share lookups: 3 attempts allowed at 401 + 1 throttled at 429
    // (no DB hit on throttle) — we wire up four to be safe in case the
    // limiter lets one extra through on a boundary.
    for (let i = 0; i < 5; i += 1) {
      sharedChartsFirst.mockResolvedValueOnce(await makeProtectedShare());
    }

    const app = buildApp();

    // Cap is 3 (set via SHARE_PASSWORD_RATE_LIMIT_MAX above).
    for (let i = 0; i < 3; i += 1) {
      const r = await request(app)
        .post(`/shared/chart/${TOKEN_PROTECTED}/access`)
        .send({ password: 'wrong' });
      expect(r.status).toBe(401);
    }

    const throttled = await request(app)
      .post(`/shared/chart/${TOKEN_PROTECTED}/access`)
      .send({ password: 'wrong' });
    expect(throttled.status).toBe(429);
    // RateLimit-* headers from express-rate-limit's standardHeaders
    expect(throttled.headers['ratelimit-limit']).toBe('3');
  });

  it('does not block GET /shared/chart/:token (public, no-password) — strict limiter is POST-only', async () => {
    // No burn needed: this test pins the contract that the strict
    // limiter is bound to POST /access only. A read-view request to a
    // public, non-password share goes through the GENERAL /shared/*
    // limiter (60/min/IP) which is mounted on app.use('/shared/'), not
    // here. We assert the read view succeeds regardless of how many
    // password attempts were made on a different share.
    sharedChartsFirst.mockResolvedValueOnce(PUBLIC_SHARE);
    chartsFirst.mockResolvedValueOnce(CHART_PUBLIC);

    const app = buildApp();
    const viewRes = await request(app).get(`/shared/chart/${TOKEN_PUBLIC}`);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.chart.name).toBe('Demo Public');
    // A normal (non-password) read view does not emit any password-limit
    // headers — those are scoped to the /access route.
    expect(viewRes.headers['ratelimit-limit']).toBeUndefined();
  });

  it('keys the limit per token — exhausting one share does NOT throttle another', async () => {
    const SECOND_TOKEN = 'second-token-limiter-test';
    for (let i = 0; i < 8; i += 1) {
      // Alternating share rows: first three for TOKEN_PROTECTED,
      // then attempts against SECOND_TOKEN.
      sharedChartsFirst.mockResolvedValueOnce(await makeProtectedShare());
    }

    const app = buildApp();

    // Burn the budget on TOKEN_PROTECTED
    for (let i = 0; i < 3; i += 1) {
      await request(app)
        .post(`/shared/chart/${TOKEN_PROTECTED}/access`)
        .send({ password: 'wrong' });
    }
    const throttled = await request(app)
      .post(`/shared/chart/${TOKEN_PROTECTED}/access`)
      .send({ password: 'wrong' });
    expect(throttled.status).toBe(429);

    // SECOND_TOKEN should have its own bucket — first attempt returns
    // 401 (wrong password), not 429.
    const fresh = await request(app)
      .post(`/shared/chart/${SECOND_TOKEN}/access`)
      .send({ password: 'wrong' });
    expect(fresh.status).toBe(401);
  });
});
