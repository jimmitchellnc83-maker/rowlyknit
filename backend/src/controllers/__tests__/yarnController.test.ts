/**
 * Regression tests for the empty-string-to-numeric 500 in yarnController,
 * found in the platform audit 2026-04-30 (Critical #4). The Add Yarn modal
 * sends `''` for unfilled numeric inputs (yardsTotal, gramsTotal,
 * pricePerSkein, ravelryRating, lowStockThreshold, ravelryId), which
 * Postgres rejected when cast to integer / numeric columns.
 */

const yarnInsert = jest.fn();
const yarnInsertReturning = jest.fn();
const yarnUpdate = jest.fn();
const yarnUpdateReturning = jest.fn();
const yarnFirst = jest.fn();

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: yarnFirst,
    insert: (payload: any) => {
      yarnInsert(payload);
      return { returning: yarnInsertReturning };
    },
    update: (payload: any) => {
      yarnUpdate(payload);
      return { returning: yarnUpdateReturning };
    },
  }));
  return { default: dbFn, __esModule: true };
});

jest.mock('../../middleware/auditLog', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/inputSanitizer', () => ({
  sanitizeSearchQuery: (s: string) => s,
}));

jest.mock('../../services/feasibilityService', () => ({
  findYarnSubstitutions: jest.fn(),
}));

import { createYarn, updateYarn } from '../yarnController';

function makeReq(body: any, params: any = {}): any {
  return { body, params, user: { userId: 'user-1' } };
}

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('createYarn — empty-string-to-numeric coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    yarnInsertReturning.mockResolvedValue([{ id: 'yarn-1' }]);
  });

  it('writes null for unfilled yardsTotal / gramsTotal / pricePerSkein / ravelryRating', async () => {
    const res = makeRes();
    await createYarn(
      makeReq({
        name: 'Test Yarn',
        brand: 'X',
        line: 'Y',
        color: 'Z',
        yardsTotal: '',
        gramsTotal: '',
        skeinsTotal: '1',
        pricePerSkein: '',
        ravelryRating: '',
        ravelryId: '',
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = yarnInsert.mock.calls[0][0];
    expect(payload.yards_total).toBeNull();
    expect(payload.yards_remaining).toBeNull();
    expect(payload.total_length_m).toBeNull();
    expect(payload.remaining_length_m).toBeNull();
    expect(payload.grams_total).toBeNull();
    expect(payload.grams_remaining).toBeNull();
    expect(payload.price_per_skein).toBeNull();
    expect(payload.ravelry_rating).toBeNull();
    expect(payload.ravelry_id).toBeNull();
  });

  it('preserves explicit numeric values (and computes meters from yards)', async () => {
    const res = makeRes();
    await createYarn(
      makeReq({
        name: 'Test Yarn',
        yardsTotal: '440',
        gramsTotal: '100',
        skeinsTotal: '2',
        pricePerSkein: '12.50',
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = yarnInsert.mock.calls[0][0];
    expect(payload.yards_total).toBe(440);
    expect(payload.grams_total).toBe(100);
    expect(payload.skeins_total).toBe(2);
    expect(payload.price_per_skein).toBe(12.5);
    // 440 yds * 0.9144 m/yd = 402.336m, rounded to 2dp
    expect(payload.total_length_m).toBe(402.34);
  });

  it('defaults skeinsTotal to 1 when empty (preserves prior behavior)', async () => {
    const res = makeRes();
    await createYarn(
      makeReq({
        name: 'Test Yarn',
        skeinsTotal: '',
      }),
      res,
    );

    const payload = yarnInsert.mock.calls[0][0];
    expect(payload.skeins_total).toBe(1);
    expect(payload.skeins_remaining).toBe(1);
  });

  it('handles purchaseDate empty string as null', async () => {
    const res = makeRes();
    await createYarn(
      makeReq({
        name: 'Test Yarn',
        purchaseDate: '',
      }),
      res,
    );

    const payload = yarnInsert.mock.calls[0][0];
    expect(payload.purchase_date).toBeNull();
  });
});

describe('updateYarn — empty-string-to-numeric coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    yarnFirst.mockResolvedValue({
      id: 'yarn-1',
      yards_total: 100,
      yards_remaining: 50,
      grams_total: 50,
      grams_remaining: 30,
      skeins_total: 1,
      skeins_remaining: 1,
      remaining_length_m: 45.72,
    });
    yarnUpdateReturning.mockResolvedValue([{ id: 'yarn-1' }]);
  });

  it('coerces empty-string yardsTotal / gramsTotal / pricePerSkein to null on update', async () => {
    const res = makeRes();
    await updateYarn(
      makeReq(
        {
          yardsTotal: '',
          gramsTotal: '',
          pricePerSkein: '',
          ravelryRating: '',
          ravelryId: '',
          lowStockThreshold: '',
        },
        { id: 'yarn-1' },
      ),
      res,
    );

    const payload = yarnUpdate.mock.calls[0][0];
    expect(payload.yards_total).toBeNull();
    expect(payload.yards_remaining).toBeNull();
    expect(payload.total_length_m).toBeNull();
    expect(payload.remaining_length_m).toBeNull();
    expect(payload.grams_total).toBeNull();
    expect(payload.grams_remaining).toBeNull();
    expect(payload.price_per_skein).toBeNull();
    expect(payload.ravelry_rating).toBeNull();
    expect(payload.ravelry_id).toBeNull();
    expect(payload.low_stock_threshold).toBeNull();
  });

  it('preserves explicit numeric updates and adjusts remaining by delta', async () => {
    const res = makeRes();
    await updateYarn(
      makeReq({ yardsTotal: '200' }, { id: 'yarn-1' }),
      res,
    );

    const payload = yarnUpdate.mock.calls[0][0];
    // delta = 200 - 100 = +100 → remaining 50 + 100 = 150
    expect(payload.yards_total).toBe(200);
    expect(payload.yards_remaining).toBe(150);
  });
});
