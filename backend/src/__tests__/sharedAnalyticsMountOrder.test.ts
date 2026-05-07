/**
 * Pin the M1 fix from PR #390 review: the `/shared/analytics` route
 * MUST mount before the broader `app.use('/shared/', publicSharedLimiter)`
 * so the dedicated 120/min `publicAnalyticsLimiter` (applied at the
 * router level) governs the analytics endpoint instead of being
 * preempted by the 60/min shared-content cap.
 *
 * This is a static source-file assertion rather than an integration
 * test on purpose — the failure mode being guarded against is a
 * future refactor that moves the analytics mount back below the
 * limiter. Reading the source proves intent without booting the app.
 */

import fs from 'fs';
import path from 'path';

const APP_TS = path.resolve(__dirname, '../app.ts');
const SOURCE = fs.readFileSync(APP_TS, 'utf8');

function indexOfMount(needle: string | RegExp): number {
  if (typeof needle === 'string') return SOURCE.indexOf(needle);
  const m = SOURCE.match(needle);
  return m && m.index !== undefined ? m.index : -1;
}

describe('app.ts: /shared/analytics mount ordering', () => {
  it('mounts publicAnalyticsRoutes on /shared/analytics exactly once', () => {
    const mountPattern = /app\.use\(['"]\/shared\/analytics['"],\s*publicAnalyticsRoutes\)/g;
    const matches = SOURCE.match(mountPattern) ?? [];
    expect(matches.length).toBe(1);
  });

  it('mounts /shared/analytics BEFORE app.use("/shared/", publicSharedLimiter)', () => {
    const analyticsIdx = indexOfMount(
      /app\.use\(['"]\/shared\/analytics['"],\s*publicAnalyticsRoutes\)/,
    );
    const limiterIdx = indexOfMount(
      /app\.use\(['"]\/shared\/['"],\s*publicSharedLimiter\)/,
    );

    expect(analyticsIdx).toBeGreaterThan(-1);
    expect(limiterIdx).toBeGreaterThan(-1);
    expect(analyticsIdx).toBeLessThan(limiterIdx);
  });

  it('still mounts the catch-all /shared sharedRoutes AFTER the limiter (limiter applies to non-analytics shares)', () => {
    const limiterIdx = indexOfMount(
      /app\.use\(['"]\/shared\/['"],\s*publicSharedLimiter\)/,
    );
    const sharedRoutesIdx = indexOfMount(
      /app\.use\(['"]\/shared['"],\s*sharedRoutes\)/,
    );

    expect(limiterIdx).toBeGreaterThan(-1);
    expect(sharedRoutesIdx).toBeGreaterThan(-1);
    expect(sharedRoutesIdx).toBeGreaterThan(limiterIdx);
  });
});
