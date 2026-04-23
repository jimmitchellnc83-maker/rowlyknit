/**
 * Unit tests for needleInventoryService. Pure composition over
 * feasibilityService; no DB. Mock the module-level db import so the
 * feasibilityService side-effect-free imports don't trip on `SELECT 1`.
 */

jest.mock('../../config/database', () => ({ default: jest.fn(), __esModule: true }));
jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

import { checkNeedleInventory } from '../needleInventoryService';
import type { ToolRow } from '../feasibilityService';

const tool = (id: string, size_mm: number, available = true): ToolRow => ({
  id,
  name: `${size_mm}mm needle`,
  type: 'needle',
  size: `${size_mm}mm`,
  size_mm,
  is_available: available,
});

describe('checkNeedleInventory', () => {
  it('returns "none" when no pattern specifies needle sizes', () => {
    const r = checkNeedleInventory([{ needle_sizes: null }, { needle_sizes: '' }], []);
    expect(r.status).toBe('none');
    expect(r.requiredSizesMm).toEqual([]);
  });

  it('returns green when every required size is owned', () => {
    const r = checkNeedleInventory(
      [{ needle_sizes: '4.5mm' }],
      [tool('a', 4.5)]
    );
    expect(r.status).toBe('green');
    expect(r.missingSizesMm).toEqual([]);
    expect(r.partialSizesMm).toEqual([]);
    expect(r.requiredSizesMm).toEqual([4.5]);
  });

  it('returns red when a required size is not owned', () => {
    const r = checkNeedleInventory(
      [{ needle_sizes: 'US 7' }], // 4.5mm
      [tool('a', 3.5), tool('b', 6.0)]
    );
    expect(r.status).toBe('red');
    expect(r.missingSizesMm).toContain(4.5);
    expect(r.message).toMatch(/Missing/);
  });

  it('dedupes required sizes across multiple patterns', () => {
    const r = checkNeedleInventory(
      [{ needle_sizes: '4.5mm' }, { needle_sizes: 'US 7' }], // both 4.5mm
      [tool('a', 4.5)]
    );
    expect(r.requiredSizesMm).toEqual([4.5]);
    expect(r.status).toBe('green');
  });

  it('collects multiple required sizes from multiple patterns', () => {
    const r = checkNeedleInventory(
      [{ needle_sizes: '4mm, 5mm' }, { needle_sizes: '6mm' }],
      [tool('a', 4), tool('b', 5)]
    );
    expect(r.requiredSizesMm).toEqual([4, 5, 6]);
    expect(r.missingSizesMm).toEqual([6]);
    expect(r.status).toBe('red');
  });

  it('ignores tools marked is_available: false', () => {
    const r = checkNeedleInventory(
      [{ needle_sizes: '4.5mm' }],
      [tool('a', 4.5, false)]
    );
    expect(r.status).toBe('red');
  });

  it('includes per-size matches in the response', () => {
    const r = checkNeedleInventory(
      [{ needle_sizes: '4mm, 5mm' }],
      [tool('a', 4)]
    );
    expect(r.matches).toHaveLength(2);
    expect(r.matches.find((m) => m.sizeMm === 4)?.status).toBe('green');
    expect(r.matches.find((m) => m.sizeMm === 5)?.status).toBe('red');
  });
});
