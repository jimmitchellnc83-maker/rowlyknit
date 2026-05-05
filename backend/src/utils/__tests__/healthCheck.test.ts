/**
 * Unit tests for the heap-pressure evaluation used by the /health endpoint.
 *
 * Previously the health check divided `heapUsed` by `heapTotal` (the current
 * committed heap) — a ratio that routinely sits at 90%+ under normal load
 * because V8 adaptively grows the heap. The fixed version divides by
 * `heap_size_limit` (the actual max-old-space-size ceiling), which is the
 * only meaningful pressure signal.
 */

jest.mock('../../config/database', () => ({ default: jest.fn(), __esModule: true }));
jest.mock('../../config/redis', () => ({
  redisClient: { ping: jest.fn(), info: jest.fn() },
  __esModule: true,
}));
jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

import { checkTransactionalEmail, evaluateNodeHeap, HeapSnapshot } from '../healthCheck';

const MB = 1024 * 1024;

function snap(overrides: Partial<HeapSnapshot> = {}): HeapSnapshot {
  return {
    heapUsed: 50 * MB,
    heapLimit: 2048 * MB,
    heapCommitted: 75 * MB,
    rss: 120 * MB,
    external: 4 * MB,
    ...overrides,
  };
}

describe('evaluateNodeHeap', () => {
  it('returns pass when heap usage is well below the limit', () => {
    const result = evaluateNodeHeap(snap({ heapUsed: 100 * MB, heapLimit: 2048 * MB }));
    expect(result.status).toBe('pass');
    expect(result.message).toBeUndefined();
  });

  it('returns pass at exactly 85% (strictly-above threshold)', () => {
    const result = evaluateNodeHeap(snap({ heapUsed: 85 * MB, heapLimit: 100 * MB }));
    expect(result.status).toBe('pass');
  });

  it('returns warn between 85% and 90%', () => {
    const result = evaluateNodeHeap(snap({ heapUsed: 87 * MB, heapLimit: 100 * MB }));
    expect(result.status).toBe('warn');
    expect(result.message).toMatch(/high heap/i);
  });

  it('returns fail above 90%', () => {
    const result = evaluateNodeHeap(snap({ heapUsed: 95 * MB, heapLimit: 100 * MB }));
    expect(result.status).toBe('fail');
    expect(result.message).toMatch(/high heap/i);
  });

  it('does NOT fail when only committed heap is saturated but the limit is far away', () => {
    // This is the pre-existing bug: V8 committed 75 MB of its 2 GB limit and
    // filled 70 MB of that. Old code: 70/75 = 93% → fail. New code: 70/2048 =
    // 3.4% → pass. This test locks in the fix.
    const result = evaluateNodeHeap(
      snap({ heapUsed: 70 * MB, heapCommitted: 75 * MB, heapLimit: 2048 * MB }),
    );
    expect(result.status).toBe('pass');
    expect(result.details!.heapPercent).toBe(`${((70 / 2048) * 100).toFixed(2)}%`);
  });

  it('exposes heapUsed, heapLimit, heapCommitted in details', () => {
    const result = evaluateNodeHeap(
      snap({ heapUsed: 100 * MB, heapLimit: 200 * MB, heapCommitted: 120 * MB }),
    );
    expect(result.details).toMatchObject({
      heapUsed: '100.00 MB',
      heapLimit: '200.00 MB',
      heapCommitted: '120.00 MB',
    });
  });

  it('does not crash when heapLimit is zero (defensive)', () => {
    const result = evaluateNodeHeap(snap({ heapUsed: 50 * MB, heapLimit: 0 }));
    expect(result.status).toBe('pass');
    expect(result.details!.heapPercent).toBe('0.00%');
  });
});

/**
 * Platform Hardening Sprint 2026-05-05 — provider-readiness polish.
 *
 * `/health.checks.transactionalEmail` and the top-level
 * `publicLaunchBlocked` boolean give admin / monitoring tooling a
 * single signal that the email gateway is in placeholder mode.
 *
 * Mirrors the env decision tree from `createEmailAdapter`: anything
 * that resolves to the no-op adapter at runtime returns `warn` here
 * AND sets `publicLaunchBlocked: true` in production.
 */
describe('checkTransactionalEmail', () => {
  const ENV_KEYS = [
    'EMAIL_PROVIDER',
    'EMAIL_API_KEY',
    'AWS_SES_ACCESS_KEY',
    'AWS_SES_SECRET_KEY',
    'NODE_ENV',
    'ALLOW_NOOP_EMAIL_IN_PRODUCTION',
  ] as const;

  const original: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeAll(() => {
    for (const k of ENV_KEYS) original[k] = process.env[k];
  });
  afterAll(() => {
    for (const k of ENV_KEYS) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k] as string;
    }
  });
  beforeEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });

  it('passes when EMAIL_PROVIDER=resend and key is set', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.EMAIL_API_KEY = 'rk_live_xxx';
    process.env.NODE_ENV = 'production';
    const result = checkTransactionalEmail();
    expect(result.status).toBe('pass');
    expect(result.details!.publicLaunchBlocked).toBe(false);
    expect(result.details!.provider).toBe('resend');
  });

  it('passes when EMAIL_PROVIDER=ses and AWS keys are set', () => {
    process.env.EMAIL_PROVIDER = 'ses';
    process.env.AWS_SES_ACCESS_KEY = 'AKIA...';
    process.env.AWS_SES_SECRET_KEY = 'secret';
    process.env.NODE_ENV = 'production';
    const result = checkTransactionalEmail();
    expect(result.status).toBe('pass');
    expect(result.details!.publicLaunchBlocked).toBe(false);
  });

  it('passes when EMAIL_PROVIDER unset but EMAIL_API_KEY set (sendgrid default)', () => {
    process.env.EMAIL_API_KEY = 'sg-key';
    process.env.NODE_ENV = 'production';
    const result = checkTransactionalEmail();
    expect(result.status).toBe('pass');
    expect(result.details!.provider).toBe('sendgrid');
    expect(result.details!.publicLaunchBlocked).toBe(false);
  });

  it('warns + flags publicLaunchBlocked when EMAIL_PROVIDER=noop in production', () => {
    process.env.EMAIL_PROVIDER = 'noop';
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_NOOP_EMAIL_IN_PRODUCTION = 'true';
    const result = checkTransactionalEmail();
    expect(result.status).toBe('warn');
    expect(result.details!.publicLaunchBlocked).toBe(true);
    expect(result.details!.provider).toBe('noop');
    // Message must explicitly call out the launch block so an admin
    // pinging /health doesn't have to guess.
    expect(result.message).toMatch(/PUBLIC LAUNCH IS BLOCKED/);
    expect(result.message).toMatch(/SPF/);
  });

  it('warns + flags publicLaunchBlocked when sendgrid is the default but EMAIL_API_KEY missing in prod', () => {
    process.env.NODE_ENV = 'production';
    // No EMAIL_API_KEY set → createEmailAdapter would throw without override.
    // The health check just reports what would happen at runtime.
    const result = checkTransactionalEmail();
    expect(result.status).toBe('warn');
    expect(result.details!.publicLaunchBlocked).toBe(true);
  });

  it('warns but does NOT flag publicLaunchBlocked outside production', () => {
    process.env.EMAIL_PROVIDER = 'noop';
    process.env.NODE_ENV = 'development';
    const result = checkTransactionalEmail();
    expect(result.status).toBe('warn');
    expect(result.details!.publicLaunchBlocked).toBe(false);
  });

  it('warns but does NOT flag publicLaunchBlocked in test env', () => {
    process.env.EMAIL_PROVIDER = 'noop';
    process.env.NODE_ENV = 'test';
    const result = checkTransactionalEmail();
    expect(result.status).toBe('warn');
    expect(result.details!.publicLaunchBlocked).toBe(false);
  });

  it('warns when ses is configured but AWS creds are missing in prod', () => {
    process.env.EMAIL_PROVIDER = 'ses';
    process.env.NODE_ENV = 'production';
    // Missing AWS keys → resolves to noop at runtime → flag the block.
    const result = checkTransactionalEmail();
    expect(result.status).toBe('warn');
    expect(result.details!.publicLaunchBlocked).toBe(true);
  });

  it('locks the provider name in details so admin tooling can render it verbatim', () => {
    process.env.EMAIL_PROVIDER = 'postmark';
    process.env.EMAIL_API_KEY = 'pm-server-token';
    process.env.NODE_ENV = 'production';
    const result = checkTransactionalEmail();
    expect(result.details!.provider).toBe('postmark');
  });
});
