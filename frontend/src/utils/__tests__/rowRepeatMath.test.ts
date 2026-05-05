/**
 * Tests for row repeat math — Sprint 1 Public Tools Conversion.
 */

import { describe, it, expect } from 'vitest';
import { computeRowRepeat } from '../rowRepeatMath';

describe('computeRowRepeat', () => {
  it('clean fit: 60 rows / 8-row repeat → 7 fulls + 4 remainder', () => {
    const out = computeRowRepeat({ totalRowsAvailable: 60, rowsPerRepeat: 8 });
    expect(out).toEqual({
      totalRowsAvailable: 60,
      rowsPerRepeat: 8,
      fullRepeats: 7,
      remainderRows: 4,
      fitsCleanly: false,
      endsAtRow: 56,
    });
  });

  it('exact fit: 64 rows / 8 → 8 fulls + 0 remainder', () => {
    const out = computeRowRepeat({ totalRowsAvailable: 64, rowsPerRepeat: 8 });
    expect(out).toEqual({
      totalRowsAvailable: 64,
      rowsPerRepeat: 8,
      fullRepeats: 8,
      remainderRows: 0,
      fitsCleanly: true,
      endsAtRow: 64,
    });
  });

  it('repeat larger than total: 4 rows / 8-row repeat → 0 fulls + 4 remainder', () => {
    const out = computeRowRepeat({ totalRowsAvailable: 4, rowsPerRepeat: 8 });
    expect(out!.fullRepeats).toBe(0);
    expect(out!.remainderRows).toBe(4);
    expect(out!.fitsCleanly).toBe(false);
  });

  it('rejects zero or negative inputs', () => {
    expect(computeRowRepeat({ totalRowsAvailable: 0, rowsPerRepeat: 8 })).toBeNull();
    expect(computeRowRepeat({ totalRowsAvailable: 60, rowsPerRepeat: 0 })).toBeNull();
    expect(computeRowRepeat({ totalRowsAvailable: -1, rowsPerRepeat: 8 })).toBeNull();
  });

  it('rejects NaN inputs', () => {
    expect(computeRowRepeat({ totalRowsAvailable: NaN, rowsPerRepeat: 8 })).toBeNull();
  });
});
