/**
 * Pure-policy tests for `isEntitledNow` — the single source of truth
 * for the Rowly entitlement decision after PR #389 P2.
 *
 * Both `BillingService.getBillingStatusForUser` and the entitlement
 * util consult this; the frontend `cancelledGraceActive` mirror has
 * matching tests in `frontend/src/lib/__tests__/entitlement.test.ts`.
 *
 * The clock is injected so we don't depend on real time.
 */

import { isEntitledNow } from '../types';

const NOW = new Date('2026-05-06T12:00:00Z');

describe('isEntitledNow — Rowly entitlement policy', () => {
  it('grants access for status=active regardless of dates', () => {
    expect(isEntitledNow('active', null, NOW)).toBe(true);
    expect(isEntitledNow('active', new Date('2020-01-01'), NOW)).toBe(true);
  });

  it('grants access for status=on_trial regardless of dates', () => {
    expect(isEntitledNow('on_trial', null, NOW)).toBe(true);
  });

  it('grants access for status=cancelled when ends_at is in the future', () => {
    const future = new Date('2026-06-01T00:00:00Z');
    expect(isEntitledNow('cancelled', future, NOW)).toBe(true);
    // ISO string form should also work — the helper accepts both.
    expect(isEntitledNow('cancelled', future.toISOString(), NOW)).toBe(true);
  });

  it('denies status=cancelled when ends_at is in the past', () => {
    const past = new Date('2026-04-01T00:00:00Z');
    expect(isEntitledNow('cancelled', past, NOW)).toBe(false);
  });

  it('denies status=cancelled when ends_at is exactly now (boundary, not strictly future)', () => {
    expect(isEntitledNow('cancelled', NOW, NOW)).toBe(false);
  });

  it('denies status=cancelled when ends_at is missing', () => {
    expect(isEntitledNow('cancelled', null, NOW)).toBe(false);
    expect(isEntitledNow('cancelled', undefined, NOW)).toBe(false);
  });

  it('denies status=cancelled when ends_at is unparseable', () => {
    expect(isEntitledNow('cancelled', 'not-a-date', NOW)).toBe(false);
  });

  it.each(['expired', 'past_due', 'unpaid', 'paused', 'unknown'])(
    'denies status=%s regardless of ends_at',
    (status) => {
      expect(isEntitledNow(status as any, null, NOW)).toBe(false);
      expect(
        isEntitledNow(status as any, new Date('2099-01-01'), NOW),
      ).toBe(false);
    },
  );

  it('denies null/undefined status', () => {
    expect(isEntitledNow(null, null, NOW)).toBe(false);
    expect(isEntitledNow(undefined, null, NOW)).toBe(false);
  });
});
