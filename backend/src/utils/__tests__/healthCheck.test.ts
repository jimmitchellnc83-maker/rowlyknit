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

import { evaluateNodeHeap, HeapSnapshot } from '../healthCheck';

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
