/**
 * Regression tests for the empty-string-to-numeric 500 in toolsController,
 * found in the platform audit 2026-04-30 (Critical #6). The Add Tool modal
 * sends '' for unfilled numeric inputs (purchasePrice, sizeMm, length,
 * quantity, cableLengthMm), and Postgres rejected those when cast to
 * integer / decimal columns.
 */

const insertSpy = jest.fn();
const insertReturning = jest.fn();
const updateSpy = jest.fn();
const updateReturning = jest.fn();
const toolFirst = jest.fn();

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: toolFirst,
    insert: (payload: any) => {
      insertSpy(payload);
      return { returning: insertReturning };
    },
    update: (payload: any) => {
      updateSpy(payload);
      return { returning: updateReturning };
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

import { createTool, updateTool } from '../toolsController';

function makeReq(body: any, params: any = {}): any {
  return { body, params, user: { userId: 'user-1' } };
}

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('createTool — empty-string-to-numeric coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insertReturning.mockResolvedValue([{ id: 'tool-1' }]);
  });

  it('writes null for unfilled purchasePrice / sizeMm / length / cableLengthMm', async () => {
    const res = makeRes();
    await createTool(
      makeReq({
        name: 'US 7 circular',
        type: 'circular_needle',
        purchasePrice: '',
        sizeMm: '',
        cableLengthMm: '',
        length: '',
        quantity: '',
        purchaseDate: '',
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = insertSpy.mock.calls[0][0];
    expect(payload.purchase_price).toBeNull();
    expect(payload.size_mm).toBeNull();
    expect(payload.cable_length_mm).toBeNull();
    expect(payload.length).toBeNull();
    expect(payload.purchase_date).toBeNull();
    // quantity defaults to 1 when empty (preserves existing behaviour)
    expect(payload.quantity).toBe(1);
  });

  it('parses numeric strings to integers / decimals', async () => {
    const res = makeRes();
    await createTool(
      makeReq({
        name: 'US 7 circular',
        type: 'circular_needle',
        purchasePrice: '12.99',
        sizeMm: '4.5',
        cableLengthMm: '813.0',
        length: '32',
        quantity: '2',
      }),
      res,
    );

    const payload = insertSpy.mock.calls[0][0];
    expect(payload.purchase_price).toBe(12.99);
    expect(payload.size_mm).toBe(4.5);
    expect(payload.cable_length_mm).toBe(813);
    expect(payload.length).toBe(32);
    expect(payload.quantity).toBe(2);
  });
});

describe('updateTool — empty-string-to-numeric coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    toolFirst.mockResolvedValue({ id: 'tool-1', user_id: 'user-1' });
    updateReturning.mockResolvedValue([{ id: 'tool-1' }]);
  });

  it('coerces empty-string numeric fields to null on update', async () => {
    const res = makeRes();
    await updateTool(
      makeReq(
        {
          purchasePrice: '',
          sizeMm: '',
          cableLengthMm: '',
          quantity: '',
        },
        { id: 'tool-1' },
      ),
      res,
    );

    const payload = updateSpy.mock.calls[0][0];
    expect(payload.purchase_price).toBeNull();
    expect(payload.size_mm).toBeNull();
    expect(payload.cable_length_mm).toBeNull();
    expect(payload.quantity).toBeNull();
  });

  it('parses numeric string updates to numbers', async () => {
    const res = makeRes();
    await updateTool(
      makeReq(
        { purchasePrice: '7.50', sizeMm: '5', quantity: '3' },
        { id: 'tool-1' },
      ),
      res,
    );

    const payload = updateSpy.mock.calls[0][0];
    expect(payload.purchase_price).toBe(7.5);
    expect(payload.size_mm).toBe(5);
    expect(payload.quantity).toBe(3);
  });
});
