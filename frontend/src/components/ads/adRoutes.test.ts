/**
 * Pin the AdSense placement policy. The lists in adRoutes.ts are the
 * single source of truth — backend dashboard, frontend slot, and these
 * tests all read from the same exports. Any future "hey can we put an
 * ad on /dashboard real quick" must edit the allowlist here AND fight
 * a failing test, which is the whole point.
 */

import { describe, it, expect } from 'vitest';
import {
  ADSENSE_PUBLISHER_ID,
  APPROVED_AD_ROUTES,
  BLOCKED_AD_SURFACES,
  isApprovedAdRoute,
} from './adRoutes';

describe('AdSense route allowlist', () => {
  it('uses the canonical publisher id', () => {
    expect(ADSENSE_PUBLISHER_ID).toBe('ca-pub-9472587145183950');
  });

  it('approves exactly the 8 public content/tool routes', () => {
    expect([...APPROVED_AD_ROUTES].sort()).toEqual(
      [
        '/calculators',
        '/calculators/gauge',
        '/calculators/size',
        '/calculators/yardage',
        '/calculators/row-repeat',
        '/calculators/shaping',
        '/help/glossary',
        '/help/knit911',
      ].sort(),
    );
  });

  it('does NOT approve the landing page or any authenticated app route', () => {
    [
      '/',
      '/dashboard',
      '/projects',
      '/patterns',
      '/yarn',
      '/tools',
      '/upgrade',
      '/account/billing',
      '/login',
      '/register',
      '/p/some-slug',
      '/c/sometoken',
      '/calculators/yarn-sub',
      '/admin/business',
      '/admin/usage',
    ].forEach((route) => {
      expect(isApprovedAdRoute(route)).toBe(false);
    });
  });

  it('approves every entry in APPROVED_AD_ROUTES', () => {
    APPROVED_AD_ROUTES.forEach((route) => {
      expect(isApprovedAdRoute(route)).toBe(true);
    });
  });

  it('approves URLs with a trailing slash and a query string (cosmetic variation)', () => {
    expect(isApprovedAdRoute('/calculators/gauge/')).toBe(true);
    expect(isApprovedAdRoute('/calculators/gauge?units=metric')).toBe(true);
    expect(isApprovedAdRoute('/calculators/gauge#faq')).toBe(true);
  });

  it('exposes a non-empty BLOCKED_AD_SURFACES list (visible policy)', () => {
    expect(BLOCKED_AD_SURFACES.length).toBeGreaterThan(0);
    // Spot-check the high-value blocks.
    const joined = BLOCKED_AD_SURFACES.join(' | ');
    expect(joined).toMatch(/landing/i);
    expect(joined).toMatch(/authenticated app/i);
    expect(joined).toMatch(/upgrade/i);
    expect(joined).toMatch(/billing/i);
  });

  it('isApprovedAdRoute rejects empty/garbage input', () => {
    expect(isApprovedAdRoute('')).toBe(false);
    expect(isApprovedAdRoute(undefined as unknown as string)).toBe(false);
    expect(isApprovedAdRoute(null as unknown as string)).toBe(false);
  });
});
