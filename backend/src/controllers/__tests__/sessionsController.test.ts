/**
 * Regression tests for the empty-string-to-numeric 500 in
 * sessionsController.createMilestone / updateMilestone, found in the
 * platform audit 2026-04-30 (Critical #6). The Milestones modal sends ''
 * for unfilled "Target rows" / "Actual rows" inputs, and Postgres rejected
 * those when cast to integer columns.
 */

const milestoneInsertSpy = jest.fn();
const milestoneInsertReturning = jest.fn();
const milestoneUpdateSpy = jest.fn();
const milestoneUpdateReturning = jest.fn();
const milestoneFirst = jest.fn();
const projectFirst = jest.fn();

jest.mock('../../config/database', () => {
  const dbFn: any = jest.fn((table: string) => {
    if (table === 'projects') {
      return {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        first: projectFirst,
      };
    }
    if (table === 'project_milestones') {
      return {
        where: jest.fn().mockReturnThis(),
        first: milestoneFirst,
        insert: (payload: any) => {
          milestoneInsertSpy(payload);
          return { returning: milestoneInsertReturning };
        },
        update: (payload: any) => {
          milestoneUpdateSpy(payload);
          return { returning: milestoneUpdateReturning };
        },
      };
    }
    return { where: jest.fn().mockReturnThis(), first: jest.fn() };
  });
  return { default: dbFn, __esModule: true };
});

jest.mock('../../middleware/auditLog', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

import { createMilestone, updateMilestone } from '../sessionsController';

function makeReq(body: any, params: any = {}): any {
  return { body, params, user: { userId: 'user-1' } };
}

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('createMilestone — empty-string-to-numeric coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    projectFirst.mockResolvedValue({ id: 'proj-1', user_id: 'user-1' });
    milestoneInsertReturning.mockResolvedValue([{ id: 'ms-1' }]);
  });

  it('writes null for empty targetRows', async () => {
    const res = makeRes();
    await createMilestone(
      makeReq({ name: 'Yoke', targetRows: '' }, { id: 'proj-1' }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(milestoneInsertSpy.mock.calls[0][0].target_rows).toBeNull();
  });

  it('parses targetRows as an integer when provided', async () => {
    const res = makeRes();
    await createMilestone(
      makeReq({ name: 'Yoke', targetRows: '40' }, { id: 'proj-1' }),
      res,
    );

    expect(milestoneInsertSpy.mock.calls[0][0].target_rows).toBe(40);
  });
});

describe('updateMilestone — empty-string-to-numeric coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    projectFirst.mockResolvedValue({ id: 'proj-1', user_id: 'user-1' });
    milestoneFirst.mockResolvedValue({ id: 'ms-1', project_id: 'proj-1' });
    milestoneUpdateReturning.mockResolvedValue([{ id: 'ms-1' }]);
  });

  it('coerces empty targetRows / actualRows / timeSpentSeconds to null', async () => {
    const res = makeRes();
    await updateMilestone(
      makeReq(
        { targetRows: '', actualRows: '', timeSpentSeconds: '' },
        { id: 'proj-1', milestoneId: 'ms-1' },
      ),
      res,
    );

    const payload = milestoneUpdateSpy.mock.calls[0][0];
    expect(payload.target_rows).toBeNull();
    expect(payload.actual_rows).toBeNull();
    expect(payload.time_spent_seconds).toBeNull();
  });

  it('parses numeric updates', async () => {
    const res = makeRes();
    await updateMilestone(
      makeReq(
        { targetRows: '50', actualRows: '48', timeSpentSeconds: '600' },
        { id: 'proj-1', milestoneId: 'ms-1' },
      ),
      res,
    );

    const payload = milestoneUpdateSpy.mock.calls[0][0];
    expect(payload.target_rows).toBe(50);
    expect(payload.actual_rows).toBe(48);
    expect(payload.time_spent_seconds).toBe(600);
  });
});
