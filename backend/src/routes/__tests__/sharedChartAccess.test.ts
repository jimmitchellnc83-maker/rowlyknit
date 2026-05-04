/**
 * Final Polish Sprint 1 — verifies the public shared-chart access flow
 * after dropping the `?password=…` query-string surface (Codex finding
 * 2026-05-04).
 *
 * The contract under test:
 *   1. Public (no-password) shares still load on GET.
 *   2. Password-protected GET without an access token → 401
 *      `password_protected: true`.
 *   3. POST /shared/chart/:token/access with the correct password →
 *      200 with `access_token` body + `share_access_<token>` cookie.
 *   4. POST /access with the wrong password → 401.
 *   5. Once the access cookie is present, GET /shared/chart/:token
 *      and /download both succeed for password-protected charts.
 *   6. Passing `?password=…` on the URL no longer grants access — the
 *      backend ignores the query and the share remains gated.
 *   7. Download for a protected share fails without the access cookie.
 *
 * The DB is fully stubbed: `shared_charts.first()` and `charts.first()`
 * are wired per-test to drive the controller through each branch. Chart
 * export is also stubbed so PDF rendering doesn't run.
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
  // knex's fn / raw helpers are referenced by trackChartView etc. —
  // the test never asserts on them but the controller calls them on
  // success paths. Provide enough surface to not crash.
  dbFn.raw = jest.fn((s: string) => s);
  dbFn.fn = { now: jest.fn(() => new Date()) };
  return { default: dbFn, __esModule: true };
});

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// The shared route now wires a strict per-(ip,token) rate limiter on
// POST /access (Final Polish audit follow-up). Replace the redis-backed
// store with an in-memory implementation that satisfies
// express-rate-limit's Store interface. The dedicated limit-math tests
// live in `sharedChartAccessLimiter.test.ts`; here we only need the
// limiter to not crash module init.
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
  return { __esModule: true, default: InMemoryStore, RedisStore: InMemoryStore };
});
jest.mock('../../config/redis', () => ({
  redisClient: { call: jest.fn().mockResolvedValue(0) },
  __esModule: true,
}));

const exportChartMock = jest.fn();
jest.mock('../../services/chartExportService', () => ({
  exportChart: (...args: unknown[]) => exportChartMock(...args),
  __esModule: true,
}));

// Stable JWT_SECRET so issued access tokens verify consistently.
process.env.JWT_SECRET = 'test-jwt-secret-share-access';
process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-share-access';

import sharedRoutes from '../shared';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/shared', sharedRoutes);
  return app;
}

const TOKEN_PUBLIC = 'public-token-1234';
const TOKEN_PROTECTED = 'protected-token-5678';
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

const CHART = {
  id: 'chart-x',
  name: 'Demo Chart',
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
  jest.clearAllMocks();
  exportChartMock.mockResolvedValue({
    buffer: Buffer.from('%PDF-fake'),
    mimeType: 'application/pdf',
    extension: 'pdf',
  });
});

describe('GET /shared/chart/:token — public (no password) charts', () => {
  it('returns the chart when the share has no password', async () => {
    sharedChartsFirst.mockResolvedValueOnce(PUBLIC_SHARE);
    chartsFirst.mockResolvedValueOnce({ ...CHART, id: 'chart-public' });

    const app = buildApp();
    const res = await request(app).get(`/shared/chart/${TOKEN_PUBLIC}`);

    expect(res.status).toBe(200);
    expect(res.body.chart.name).toBe('Demo Chart');
    expect(res.body.share_options.allow_download).toBe(true);
  });

  it('still returns 404 when the token is unknown', async () => {
    sharedChartsFirst.mockResolvedValueOnce(undefined);

    const app = buildApp();
    const res = await request(app).get('/shared/chart/missing');

    expect(res.status).toBe(404);
  });
});

describe('GET /shared/chart/:token — password-protected charts', () => {
  it('blocks GET without an access cookie (password_required)', async () => {
    sharedChartsFirst.mockResolvedValueOnce(await makeProtectedShare());

    const app = buildApp();
    const res = await request(app).get(`/shared/chart/${TOKEN_PROTECTED}`);

    expect(res.status).toBe(401);
    expect(res.body.password_protected).toBe(true);
    // Critical: the chart row must NOT have been fetched without auth.
    expect(chartsFirst).not.toHaveBeenCalled();
  });

  it('ignores ?password=… on the URL and still returns 401', async () => {
    sharedChartsFirst.mockResolvedValueOnce(await makeProtectedShare());

    const app = buildApp();
    const res = await request(app).get(
      `/shared/chart/${TOKEN_PROTECTED}?password=${encodeURIComponent(PASSWORD)}`
    );

    // The query string must no longer be a valid credential — proves
    // we removed the legacy `?password=` flow end-to-end.
    expect(res.status).toBe(401);
    expect(res.body.password_protected).toBe(true);
    expect(chartsFirst).not.toHaveBeenCalled();
  });
});

describe('POST /shared/chart/:token/access — password verification', () => {
  it('returns 400 when no password is supplied', async () => {
    const app = buildApp();
    const res = await request(app)
      .post(`/shared/chart/${TOKEN_PROTECTED}/access`)
      .send({});

    // The route validator rejects an empty body before it reaches the
    // controller (express-validator returns a 400 ValidationError).
    expect(res.status).toBe(400);
  });

  it('returns 401 with the wrong password', async () => {
    sharedChartsFirst.mockResolvedValueOnce(await makeProtectedShare());

    const app = buildApp();
    const res = await request(app)
      .post(`/shared/chart/${TOKEN_PROTECTED}/access`)
      .send({ password: 'wrong' });

    expect(res.status).toBe(401);
  });

  it('returns 200 + access_token + access cookie with the correct password', async () => {
    sharedChartsFirst.mockResolvedValueOnce(await makeProtectedShare());

    const app = buildApp();
    const res = await request(app)
      .post(`/shared/chart/${TOKEN_PROTECTED}/access`)
      .send({ password: PASSWORD });

    expect(res.status).toBe(200);
    expect(typeof res.body.access_token).toBe('string');
    expect(res.body.access_token.length).toBeGreaterThan(20);
    expect(res.body.expires_at).toEqual(expect.any(String));

    const setCookie = (res.headers['set-cookie'] || []) as unknown as string[];
    expect(setCookie.some((c) => c.startsWith(`share_access_${TOKEN_PROTECTED}=`))).toBe(
      true
    );
    expect(setCookie.some((c) => /HttpOnly/i.test(c))).toBe(true);
  });

  it('returns 400 if the share is not password-protected', async () => {
    sharedChartsFirst.mockResolvedValueOnce(PUBLIC_SHARE);

    const app = buildApp();
    const res = await request(app)
      .post(`/shared/chart/${TOKEN_PUBLIC}/access`)
      .send({ password: 'anything' });

    expect(res.status).toBe(400);
  });
});

describe('GET after POST /access — full happy path', () => {
  it('GET succeeds when the access token is supplied via cookie', async () => {
    // First request: POST /access — share lookup #1.
    // Second request: GET /shared/chart/:token — share lookup #2 + chart lookup.
    const protectedShare = await makeProtectedShare();
    sharedChartsFirst
      .mockResolvedValueOnce(protectedShare)
      .mockResolvedValueOnce(protectedShare);
    chartsFirst.mockResolvedValueOnce({ ...CHART, id: 'chart-protected' });

    const app = buildApp();
    const agent = request.agent(app);

    const accessRes = await agent
      .post(`/shared/chart/${TOKEN_PROTECTED}/access`)
      .send({ password: PASSWORD });
    expect(accessRes.status).toBe(200);

    const viewRes = await agent.get(`/shared/chart/${TOKEN_PROTECTED}`);
    expect(viewRes.status).toBe(200);
    expect(viewRes.body.chart.name).toBe('Demo Chart');
  });

  it('GET succeeds when the access token is supplied via x-share-access header', async () => {
    const protectedShare = await makeProtectedShare();
    sharedChartsFirst
      .mockResolvedValueOnce(protectedShare)
      .mockResolvedValueOnce(protectedShare);
    chartsFirst.mockResolvedValueOnce({ ...CHART, id: 'chart-protected' });

    const app = buildApp();
    const accessRes = await request(app)
      .post(`/shared/chart/${TOKEN_PROTECTED}/access`)
      .send({ password: PASSWORD });
    const accessToken = accessRes.body.access_token as string;
    expect(accessToken).toBeTruthy();

    const viewRes = await request(app)
      .get(`/shared/chart/${TOKEN_PROTECTED}`)
      .set('x-share-access', accessToken);
    expect(viewRes.status).toBe(200);
  });
});

describe('GET /shared/chart/:token/download — password gating', () => {
  it('blocks download without the access cookie for protected charts', async () => {
    sharedChartsFirst.mockResolvedValueOnce(await makeProtectedShare());

    const app = buildApp();
    const res = await request(app).get(
      `/shared/chart/${TOKEN_PROTECTED}/download?format=pdf`
    );

    expect(res.status).toBe(401);
    expect(exportChartMock).not.toHaveBeenCalled();
    expect(chartsFirst).not.toHaveBeenCalled();
  });

  it('ignores ?password=… on download URLs', async () => {
    sharedChartsFirst.mockResolvedValueOnce(await makeProtectedShare());

    const app = buildApp();
    const res = await request(app).get(
      `/shared/chart/${TOKEN_PROTECTED}/download?password=${encodeURIComponent(PASSWORD)}&format=pdf`
    );

    expect(res.status).toBe(401);
    expect(exportChartMock).not.toHaveBeenCalled();
  });

  it('downloads when access cookie is present', async () => {
    const protectedShare = await makeProtectedShare();
    sharedChartsFirst
      .mockResolvedValueOnce(protectedShare)
      .mockResolvedValueOnce(protectedShare);
    chartsFirst.mockResolvedValueOnce({ ...CHART, id: 'chart-protected' });

    const app = buildApp();
    const agent = request.agent(app);

    await agent
      .post(`/shared/chart/${TOKEN_PROTECTED}/access`)
      .send({ password: PASSWORD });

    const res = await agent.get(
      `/shared/chart/${TOKEN_PROTECTED}/download?format=pdf`
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(exportChartMock).toHaveBeenCalledTimes(1);
  });

  it('downloads a public (no-password) share without any access token', async () => {
    sharedChartsFirst.mockResolvedValueOnce(PUBLIC_SHARE);
    chartsFirst.mockResolvedValueOnce({ ...CHART, id: 'chart-public' });

    const app = buildApp();
    const res = await request(app).get(
      `/shared/chart/${TOKEN_PUBLIC}/download?format=pdf`
    );
    expect(res.status).toBe(200);
    expect(exportChartMock).toHaveBeenCalledTimes(1);
  });
});
