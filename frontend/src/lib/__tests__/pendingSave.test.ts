/**
 * Tests for pendingSave — Sprint 1 Public Tools Conversion.
 *
 * Cover:
 *   - set / peek / consume round-trip
 *   - consume removes the entry
 *   - peek does NOT remove
 *   - corrupt JSON → null + auto-clear
 *   - expired (>24h) → null + auto-clear
 *   - clearPendingSave is idempotent
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  setPendingSave,
  peekPendingSave,
  consumePendingSave,
  clearPendingSave,
  PENDING_SAVE_STORAGE_KEY,
} from '../pendingSave';
import type { ToolResult } from '../toolResult';

const SAMPLE_RESULT: ToolResult = {
  toolId: 'gauge',
  toolVersion: '1',
  inputs: { foo: 'bar' },
  result: {
    status: 'on_gauge',
    userStitchesPerInch: 5,
    userRowsPerInch: 7,
    patternStitchesPerInch: 5,
    patternRowsPerInch: 7,
    driftStitchesPerInch: 0,
    driftRowsPerInch: 0,
  },
  humanSummary: 'On gauge — 5 sts × 7 rows.',
  recommendedSaveTargets: ['project', 'pattern'],
  createdAt: '2026-05-05T20:00:00.000Z',
};

describe('pendingSave', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('set + peek + consume round-trip preserves the result', () => {
    setPendingSave(SAMPLE_RESULT, '/calculators/gauge?pendingSave=1');

    const peeked = peekPendingSave();
    expect(peeked).not.toBeNull();
    expect(peeked!.result).toEqual(SAMPLE_RESULT);
    expect(peeked!.returnPath).toBe('/calculators/gauge?pendingSave=1');

    const consumed = consumePendingSave();
    expect(consumed).not.toBeNull();
    expect(consumed!.result).toEqual(SAMPLE_RESULT);
  });

  it('consume removes the entry; second consume returns null', () => {
    setPendingSave(SAMPLE_RESULT, '/calculators/gauge');
    expect(consumePendingSave()).not.toBeNull();
    expect(consumePendingSave()).toBeNull();
    expect(peekPendingSave()).toBeNull();
  });

  it('peek does NOT remove', () => {
    setPendingSave(SAMPLE_RESULT, '/calculators/gauge');
    peekPendingSave();
    expect(peekPendingSave()).not.toBeNull();
  });

  it('corrupt JSON returns null and wipes the entry', () => {
    localStorage.setItem(PENDING_SAVE_STORAGE_KEY, '{not json');
    expect(peekPendingSave()).toBeNull();
    expect(localStorage.getItem(PENDING_SAVE_STORAGE_KEY)).toBeNull();
  });

  it('expired entries (>24h) return null and are wiped', () => {
    const stale = {
      v: 1 as const,
      storedAt: Date.now() - 25 * 60 * 60 * 1000,
      returnPath: '/calculators/gauge',
      result: SAMPLE_RESULT,
    };
    localStorage.setItem(PENDING_SAVE_STORAGE_KEY, JSON.stringify(stale));
    expect(peekPendingSave()).toBeNull();
    expect(localStorage.getItem(PENDING_SAVE_STORAGE_KEY)).toBeNull();
  });

  it('unknown envelope version returns null and wipes', () => {
    localStorage.setItem(
      PENDING_SAVE_STORAGE_KEY,
      JSON.stringify({
        v: 99,
        storedAt: Date.now(),
        returnPath: '/calculators/gauge',
        result: SAMPLE_RESULT,
      }),
    );
    expect(peekPendingSave()).toBeNull();
    expect(localStorage.getItem(PENDING_SAVE_STORAGE_KEY)).toBeNull();
  });

  it('clearPendingSave is idempotent', () => {
    expect(() => clearPendingSave()).not.toThrow();
    setPendingSave(SAMPLE_RESULT, '/calculators/gauge');
    clearPendingSave();
    expect(peekPendingSave()).toBeNull();
    expect(() => clearPendingSave()).not.toThrow();
  });
});
