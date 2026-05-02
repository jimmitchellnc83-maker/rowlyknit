/**
 * Wave 5 — chartAlignmentService unit tests.
 *
 * assertValidAlignment is the load-bearing input gate (mirrors the DB
 * CHECK constraints). setAlignment refuses on foreign crops.
 */

const dbBuilders: any = {
  pattern_crops: {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn(),
  },
  chart_alignments: {
    where: jest.fn().mockReturnThis(),
    first: jest.fn(),
    insert: jest.fn(() => ({ onConflict: jest.fn().mockReturnThis(), merge: jest.fn().mockResolvedValue(1) })),
  },
};

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    return dbBuilders[table] ?? { where: jest.fn().mockReturnThis(), first: jest.fn() };
  });
  return { default: dbFn, __esModule: true };
});

import {
  assertValidAlignment,
  setAlignment,
} from '../chartAlignmentService';
import { ValidationError } from '../../utils/errorHandler';

describe('assertValidAlignment', () => {
  const valid = {
    cropId: 'c-1',
    userId: 'u-1',
    gridX: 0.1,
    gridY: 0.1,
    gridWidth: 0.5,
    gridHeight: 0.5,
    cellsAcross: 10,
    cellsDown: 10,
  };

  it('accepts a valid input', () => {
    expect(() => assertValidAlignment(valid)).not.toThrow();
  });

  it('rejects non-positive cell counts', () => {
    expect(() => assertValidAlignment({ ...valid, cellsAcross: 0 })).toThrow(ValidationError);
    expect(() => assertValidAlignment({ ...valid, cellsDown: -1 })).toThrow(ValidationError);
  });

  it('rejects non-integer cell counts', () => {
    expect(() => assertValidAlignment({ ...valid, cellsAcross: 10.5 })).toThrow(ValidationError);
  });

  it('rejects out-of-range origins', () => {
    expect(() => assertValidAlignment({ ...valid, gridX: -0.1 })).toThrow(ValidationError);
    expect(() => assertValidAlignment({ ...valid, gridY: 1.5 })).toThrow(ValidationError);
  });

  it('rejects rectangles that escape the unit square', () => {
    expect(() =>
      assertValidAlignment({ ...valid, gridX: 0.7, gridWidth: 0.5 })
    ).toThrow(ValidationError);
  });
});

describe('setAlignment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when crop is foreign', async () => {
    dbBuilders.pattern_crops.first.mockResolvedValueOnce(null);
    const r = await setAlignment({
      cropId: 'crop-foreign',
      userId: 'u-attacker',
      gridX: 0,
      gridY: 0,
      gridWidth: 0.5,
      gridHeight: 0.5,
      cellsAcross: 10,
      cellsDown: 10,
    });
    expect(r).toBeNull();
  });
});
