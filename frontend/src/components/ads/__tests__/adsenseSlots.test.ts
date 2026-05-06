/**
 * Tests for the frontend AdSense slot helpers.
 *
 * Mirrors the backend `config/__tests__/adsenseSlots.test.ts` so the
 * FE / BE rules around "what counts as a real slot id" stay in sync.
 */

import { describe, it, expect } from 'vitest';
import { getAdSlotId, isRealSlotId, SLOT_DEFS } from '../adsenseSlots';

describe('isRealSlotId', () => {
  it('returns false for empty / placeholder values', () => {
    expect(isRealSlotId('')).toBe(false);
    expect(isRealSlotId('rowly-gauge')).toBe(false);
    expect(isRealSlotId('rowly-test')).toBe(false);
    expect(isRealSlotId('abc123')).toBe(false);
  });

  it('returns true for a real-looking 10-digit numeric id', () => {
    expect(isRealSlotId('1234567890')).toBe(true);
  });

  it('rejects non-numeric and short ids', () => {
    expect(isRealSlotId('123456789a')).toBe(false);
    expect(isRealSlotId('12345')).toBe(false);
  });
});

describe('getAdSlotId', () => {
  it('falls back to a `rowly-<tool>` placeholder when no env var is set', () => {
    expect(getAdSlotId('gauge')).toBe('rowly-gauge');
    expect(getAdSlotId('size')).toBe('rowly-size');
  });

  it('returns the placeholder for unknown tool ids too', () => {
    expect(getAdSlotId('not-a-real-tool')).toBe('rowly-not-a-real-tool');
  });
});

describe('SLOT_DEFS', () => {
  it('covers every approved tool route from adRoutes.ts', () => {
    const tools = SLOT_DEFS.map((s) => s.tool).sort();
    expect(tools).toEqual(
      [
        'calculators-index',
        'gauge',
        'glossary',
        'knit911',
        'row-repeat',
        'shaping',
        'size',
        'yardage',
      ].sort(),
    );
  });

  it('every env var name is uppercase snake_case prefixed with VITE_ADSENSE_SLOT_', () => {
    for (const def of SLOT_DEFS) {
      expect(def.envName).toMatch(/^VITE_ADSENSE_SLOT_[A-Z_0-9]+$/);
    }
  });
});
