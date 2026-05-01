/**
 * Regression tests for the empty-string-to-numeric 500 in patternsController,
 * found in the platform audit 2026-04-30 (Critical #6). The "estimated yardage"
 * field on the Add/Edit Pattern modal sends '' when blank, and Postgres rejects
 * '' cast to integer.
 */

const insertSpy = jest.fn();
const insertReturning = jest.fn();
const updateSpy = jest.fn();
const updateReturning = jest.fn();
const patternFirst = jest.fn();

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: patternFirst,
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

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

jest.mock('../../services/patternService', () => ({
  importDesignerSnapshot: jest.fn().mockResolvedValue(undefined),
}));

import { createPattern, updatePattern } from '../patternsController';

function makeReq(body: any, params: any = {}): any {
  return { body, params, user: { userId: 'user-1' } };
}

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('createPattern — empty-string-to-numeric coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insertReturning.mockResolvedValue([{ id: 'pattern-1' }]);
  });

  it('coerces empty estimatedYardage to null on insert', async () => {
    const res = makeRes();
    await createPattern(
      makeReq({ name: 'Cabled Pullover', estimatedYardage: '' }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(insertSpy.mock.calls[0][0].estimated_yardage).toBeNull();
  });

  it('parses a numeric estimatedYardage string to an integer', async () => {
    const res = makeRes();
    await createPattern(
      makeReq({ name: 'Cabled Pullover', estimatedYardage: '1200' }),
      res,
    );

    expect(insertSpy.mock.calls[0][0].estimated_yardage).toBe(1200);
  });
});

describe('updatePattern — empty-string-to-numeric coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    patternFirst.mockResolvedValue({ id: 'pattern-1', user_id: 'user-1' });
    updateReturning.mockResolvedValue([{ id: 'pattern-1' }]);
  });

  it('coerces empty estimatedYardage to null on update', async () => {
    const res = makeRes();
    await updatePattern(
      makeReq({ estimatedYardage: '' }, { id: 'pattern-1' }),
      res,
    );

    expect(updateSpy.mock.calls[0][0].estimated_yardage).toBeNull();
  });

  it('parses a numeric estimatedYardage string on update', async () => {
    const res = makeRes();
    await updatePattern(
      makeReq({ estimatedYardage: '850' }, { id: 'pattern-1' }),
      res,
    );

    expect(updateSpy.mock.calls[0][0].estimated_yardage).toBe(850);
  });
});
