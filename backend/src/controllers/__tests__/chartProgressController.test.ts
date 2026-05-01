/**
 * Regression tests for the empty-string-to-numeric 500 in
 * chartProgressController, found in the platform audit 2026-04-30 (Critical
 * #6). The chart-progress UI sends '' for unfilled `row` / `column` /
 * `current_row` / `current_column` inputs, and Postgres rejected those when
 * cast to integer columns.
 */

const progressInsertSpy = jest.fn();
const progressMergeSpy = jest.fn();
const progressUpdateSpy = jest.fn();
const progressInsertReturning = jest.fn();
const progressUpdateReturning = jest.fn();
const progressFirst = jest.fn();
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
    if (table === 'chart_progress') {
      return {
        where: jest.fn().mockReturnThis(),
        first: progressFirst,
        insert: (payload: any) => {
          progressInsertSpy(payload);
          // Support both raw insert + onConflict().merge() chains
          const onConflict = jest.fn().mockReturnValue({
            merge: (mergePayload: any) => {
              progressMergeSpy(mergePayload);
              return { returning: progressInsertReturning };
            },
          });
          return {
            onConflict,
            returning: progressInsertReturning,
          };
        },
        update: (payload: any) => {
          progressUpdateSpy(payload);
          return { returning: progressUpdateReturning };
        },
      };
    }
    return { where: jest.fn().mockReturnThis(), first: jest.fn() };
  });
  return { default: dbFn, __esModule: true };
});

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

jest.mock('../../services/chartDirectionService', () => ({
  default: {
    setWorkingDirection: jest.fn(),
    advanceStitch: jest.fn(),
    toggleDirection: jest.fn(),
  },
}));

import { updateProgress, markCell, markRow } from '../chartProgressController';

function makeReq(body: any, params: any = {}): any {
  return { body, params, user: { userId: 'user-1' } };
}

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('updateProgress — empty-string-to-numeric coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    projectFirst.mockResolvedValue({ id: 'proj-1', user_id: 'user-1' });
    progressInsertReturning.mockResolvedValue([
      { current_row: null, current_column: null, completed_cells: '[]', completed_rows: '[]' },
    ]);
  });

  it('coerces empty current_row / current_column to null in upsert payload', async () => {
    const res = makeRes();
    await updateProgress(
      makeReq(
        { current_row: '', current_column: '' },
        { projectId: 'proj-1', chartId: 'chart-1' },
      ),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const insertPayload = progressInsertSpy.mock.calls[0][0];
    expect(insertPayload.current_row).toBeNull();
    expect(insertPayload.current_column).toBeNull();
    const mergePayload = progressMergeSpy.mock.calls[0][0];
    expect(mergePayload.current_row).toBeNull();
    expect(mergePayload.current_column).toBeNull();
  });

  it('parses numeric current_row / current_column strings', async () => {
    const res = makeRes();
    await updateProgress(
      makeReq(
        { current_row: '7', current_column: '3' },
        { projectId: 'proj-1', chartId: 'chart-1' },
      ),
      res,
    );

    const insertPayload = progressInsertSpy.mock.calls[0][0];
    expect(insertPayload.current_row).toBe(7);
    expect(insertPayload.current_column).toBe(3);
  });
});

describe('markCell — empty-string-to-numeric coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    projectFirst.mockResolvedValue({ id: 'proj-1', user_id: 'user-1' });
    progressFirst.mockResolvedValue({
      project_id: 'proj-1',
      chart_id: 'chart-1',
      completed_cells: '[]',
      completed_rows: '[]',
      current_row: 0,
      current_column: 0,
    });
    progressUpdateReturning.mockResolvedValue([
      { current_row: null, current_column: null, completed_rows: '[]' },
    ]);
  });

  it('coerces empty row / column to null in update payload', async () => {
    const res = makeRes();
    await markCell(
      makeReq(
        { row: '', column: '', completed: true },
        { projectId: 'proj-1', chartId: 'chart-1' },
      ),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = progressUpdateSpy.mock.calls[0][0];
    expect(payload.current_row).toBeNull();
    expect(payload.current_column).toBeNull();
  });

  it('parses numeric row / column and writes them to the cell list', async () => {
    const res = makeRes();
    await markCell(
      makeReq(
        { row: '4', column: '2', completed: true },
        { projectId: 'proj-1', chartId: 'chart-1' },
      ),
      res,
    );

    const payload = progressUpdateSpy.mock.calls[0][0];
    expect(payload.current_row).toBe(4);
    expect(payload.current_column).toBe(2);
    expect(JSON.parse(payload.completed_cells)).toEqual([{ row: 4, col: 2 }]);
  });
});

describe('markRow — empty-string-to-numeric coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    projectFirst.mockResolvedValue({ id: 'proj-1', user_id: 'user-1' });
    progressFirst.mockResolvedValue({
      project_id: 'proj-1',
      chart_id: 'chart-1',
      completed_cells: '[]',
      completed_rows: '[]',
      current_row: 0,
      current_column: 0,
    });
    progressUpdateReturning.mockResolvedValue([
      { current_row: null, current_column: null, completed_rows: '[]' },
    ]);
  });

  it('coerces empty row to null in update payload (no NaN math)', async () => {
    const res = makeRes();
    await markRow(
      makeReq(
        { row: '', completed: true, totalColumns: 5 },
        { projectId: 'proj-1', chartId: 'chart-1' },
      ),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(200);
    const payload = progressUpdateSpy.mock.calls[0][0];
    expect(payload.current_row).toBeNull();
  });

  it('parses numeric row and advances current_row by 1 when completing', async () => {
    const res = makeRes();
    await markRow(
      makeReq(
        { row: '6', completed: true, totalColumns: 3 },
        { projectId: 'proj-1', chartId: 'chart-1' },
      ),
      res,
    );

    const payload = progressUpdateSpy.mock.calls[0][0];
    // completed === true && row=6 -> next current_row = 7
    expect(payload.current_row).toBe(7);
  });
});
