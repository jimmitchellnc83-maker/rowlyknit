/**
 * Tests for progress-state math — PR 6 of the Designer rebuild.
 *
 * The functions are tiny but they back every Make-mode button. Locking
 * in immutability + clamping + the "no totalRows = unbounded" rule
 * prevents off-by-one bugs that would corrupt a knitter's count.
 */

import { describe, it, expect } from 'vitest';
import {
  completeSection,
  decrementCounter,
  decrementRow,
  incrementCounter,
  incrementRow,
  isSectionComplete,
  resetSection,
  rowForSection,
  sectionFraction,
  setActiveSection,
  setCounter,
  setRow,
} from '../progressMath';
import type { ProgressState } from '../../types/pattern';

const empty: ProgressState = {};

describe('rowForSection', () => {
  it('returns 0 when never tracked', () => {
    expect(rowForSection(empty, 'sec-a')).toBe(0);
  });

  it('returns the stored row', () => {
    expect(
      rowForSection({ rowsBySection: { 'sec-a': 12 } }, 'sec-a'),
    ).toBe(12);
  });
});

describe('setRow', () => {
  it('writes the row + sets activeSection on first touch', () => {
    const out = setRow(empty, 'sec-a', 5);
    expect(out.rowsBySection).toEqual({ 'sec-a': 5 });
    expect(out.activeSectionId).toBe('sec-a');
  });

  it('clamps negative values to 0', () => {
    const out = setRow(empty, 'sec-a', -3);
    expect(out.rowsBySection!['sec-a']).toBe(0);
  });

  it('floors fractional values', () => {
    const out = setRow(empty, 'sec-a', 4.7);
    expect(out.rowsBySection!['sec-a']).toBe(4);
  });

  it('clamps above totalRows when supplied', () => {
    const out = setRow(empty, 'sec-a', 99, 30);
    expect(out.rowsBySection!['sec-a']).toBe(30);
  });

  it('does not mutate the input state', () => {
    const before: ProgressState = { rowsBySection: { 'sec-a': 1 } };
    const snapshot = { ...before, rowsBySection: { ...before.rowsBySection } };
    setRow(before, 'sec-a', 5);
    expect(before).toEqual(snapshot);
  });

  it('preserves an existing activeSectionId', () => {
    const out = setRow(
      { activeSectionId: 'sec-other' },
      'sec-a',
      1,
    );
    expect(out.activeSectionId).toBe('sec-other');
  });
});

describe('incrementRow', () => {
  it('moves +1 from 0', () => {
    const out = incrementRow(empty, 'sec-a');
    expect(out.rowsBySection!['sec-a']).toBe(1);
  });

  it('honors totalRows cap', () => {
    const out = incrementRow({ rowsBySection: { 'sec-a': 30 } }, 'sec-a', 30);
    expect(out.rowsBySection!['sec-a']).toBe(30);
  });
});

describe('decrementRow', () => {
  it('moves -1 from a positive value', () => {
    const out = decrementRow({ rowsBySection: { 'sec-a': 3 } }, 'sec-a');
    expect(out.rowsBySection!['sec-a']).toBe(2);
  });

  it('clamps at 0', () => {
    const out = decrementRow({ rowsBySection: { 'sec-a': 0 } }, 'sec-a');
    expect(out.rowsBySection!['sec-a']).toBe(0);
  });
});

describe('completeSection', () => {
  it('jumps the row to totalRows', () => {
    const out = completeSection(empty, 'sec-a', 30);
    expect(out.rowsBySection!['sec-a']).toBe(30);
  });

  it('is a no-op when totalRows is unknown', () => {
    const out = completeSection(empty, 'sec-a', undefined);
    expect(out).toBe(empty);
  });
});

describe('resetSection', () => {
  it('sends the row back to 0', () => {
    const out = resetSection({ rowsBySection: { 'sec-a': 47 } }, 'sec-a');
    expect(out.rowsBySection!['sec-a']).toBe(0);
  });
});

describe('setActiveSection', () => {
  it('sets and clears the active section pointer', () => {
    const a = setActiveSection(empty, 'sec-x');
    expect(a.activeSectionId).toBe('sec-x');
    const b = setActiveSection(a, null);
    expect(b.activeSectionId).toBeNull();
  });
});

describe('counter helpers', () => {
  it('setCounter writes a value, clamps negatives, floors fractions', () => {
    expect(setCounter(empty, 'c', 5).counters).toEqual({ c: 5 });
    expect(setCounter(empty, 'c', -2).counters).toEqual({ c: 0 });
    expect(setCounter(empty, 'c', 4.9).counters).toEqual({ c: 4 });
  });

  it('incrementCounter / decrementCounter respect 0-clamp', () => {
    expect(incrementCounter(empty, 'c').counters).toEqual({ c: 1 });
    expect(decrementCounter(empty, 'c').counters).toEqual({ c: 0 });
    expect(decrementCounter({ counters: { c: 3 } }, 'c').counters).toEqual({ c: 2 });
  });
});

describe('sectionFraction', () => {
  it('returns 0 when totalRows is unknown', () => {
    expect(sectionFraction({ rowsBySection: { 'sec-a': 5 } }, 'sec-a', undefined)).toBe(0);
  });

  it('returns 0.5 at half', () => {
    expect(sectionFraction({ rowsBySection: { 'sec-a': 15 } }, 'sec-a', 30)).toBe(0.5);
  });

  it('clamps above 1', () => {
    expect(sectionFraction({ rowsBySection: { 'sec-a': 999 } }, 'sec-a', 30)).toBe(1);
  });
});

describe('isSectionComplete', () => {
  it('true at total, false below', () => {
    expect(isSectionComplete({ rowsBySection: { 'sec-a': 30 } }, 'sec-a', 30)).toBe(true);
    expect(isSectionComplete({ rowsBySection: { 'sec-a': 29 } }, 'sec-a', 30)).toBe(false);
  });

  it('false when totalRows is undefined', () => {
    expect(isSectionComplete({ rowsBySection: { 'sec-a': 100 } }, 'sec-a', undefined)).toBe(false);
  });
});
