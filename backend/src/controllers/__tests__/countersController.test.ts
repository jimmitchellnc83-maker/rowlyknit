/**
 * Regression tests for the empty-string-to-numeric 500 in countersController,
 * found in the platform audit 2026-04-30 (Critical #6). The Add/Edit Counter
 * modal sends '' for unfilled `target_value` / `min_value` / `max_value`
 * inputs, and Postgres rejected those when cast to integer columns.
 */

const counterInsertSpy = jest.fn();
const counterInsertReturning = jest.fn();
const counterUpdateSpy = jest.fn();
const counterUpdateReturning = jest.fn();
const counterFirst = jest.fn();

const counterHistoryInsertSpy = jest.fn();
const counterMaxSpy = jest.fn();

const counterLinksWhereSpy = jest.fn();

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
    if (table === 'counters') {
      const builder: any = {
        where: jest.fn().mockReturnThis(),
        whereNull: jest.fn().mockReturnThis(),
        max: jest.fn().mockReturnThis(),
        first: jest.fn().mockImplementation(() => {
          // Distinguish "find counter" vs "max sort_order" by checking
          // whether max() was called on this builder. We track this with a
          // simple call-count heuristic.
          if (counterMaxSpy.mock.calls.length > counterFirst.mock.calls.length) {
            counterMaxSpy({ maxOrder: 0 });
            return Promise.resolve({ maxOrder: 0 });
          }
          return counterFirst();
        }),
        insert: (payload: any) => {
          counterInsertSpy(payload);
          return { returning: counterInsertReturning };
        },
        update: (payload: any) => {
          counterUpdateSpy(payload);
          return { returning: counterUpdateReturning };
        },
      };
      // Override max so the chain after .max().first() resolves predictably
      builder.max = jest.fn().mockImplementation(() => ({
        first: () => Promise.resolve({ maxOrder: 0 }),
      }));
      return builder;
    }
    if (table === 'counter_history') {
      return {
        where: jest.fn().mockReturnThis(),
        first: jest.fn(),
        insert: (payload: any) => {
          counterHistoryInsertSpy(payload);
          return Promise.resolve();
        },
      };
    }
    if (table === 'counter_links') {
      return {
        where: counterLinksWhereSpy.mockResolvedValue([]),
      };
    }
    return { where: jest.fn().mockReturnThis(), first: jest.fn() };
  });
  return { default: dbFn, __esModule: true };
});

jest.mock('../../middleware/auditLog', () => ({
  createAuditLog: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../config/socket', () => ({
  getIO: () => ({
    to: () => ({ emit: jest.fn() }),
  }),
}));

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
  __esModule: true,
}));

import { createCounter, updateCounter } from '../countersController';

function makeReq(body: any, params: any = {}): any {
  return { body, params, user: { userId: 'user-1' } };
}

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('createCounter — empty-string-to-numeric coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    projectFirst.mockResolvedValue({ id: 'proj-1', user_id: 'user-1' });
    counterInsertReturning.mockResolvedValue([{ id: 'ctr-1' }]);
  });

  it('coerces empty target/min/max/increment_by to null and currentValue to 0', async () => {
    const res = makeRes();
    await createCounter(
      makeReq(
        {
          name: 'Rows',
          currentValue: '',
          targetValue: '',
          incrementBy: '',
          minValue: '',
          maxValue: '',
        },
        { id: 'proj-1' },
      ),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = counterInsertSpy.mock.calls[0][0];
    // counter_history.new_value is NOT NULL, so empty currentValue falls
    // back to 0 to keep the initial history insert valid.
    expect(payload.current_value).toBe(0);
    expect(payload.target_value).toBeNull();
    expect(payload.min_value).toBeNull();
    expect(payload.max_value).toBeNull();
    // increment_by has an existing default of 1 — preserve that.
    expect(payload.increment_by).toBe(1);

    // Also verify the history insert got the coerced value
    const historyPayload = counterHistoryInsertSpy.mock.calls[0][0];
    expect(historyPayload.new_value).toBe(0);
  });

  it('parses numeric strings as integers', async () => {
    const res = makeRes();
    await createCounter(
      makeReq(
        {
          name: 'Rows',
          currentValue: '5',
          targetValue: '100',
          incrementBy: '2',
          minValue: '0',
          maxValue: '120',
        },
        { id: 'proj-1' },
      ),
      res,
    );

    const payload = counterInsertSpy.mock.calls[0][0];
    expect(payload.current_value).toBe(5);
    expect(payload.target_value).toBe(100);
    expect(payload.increment_by).toBe(2);
    expect(payload.min_value).toBe(0);
    expect(payload.max_value).toBe(120);
  });
});

describe('updateCounter — empty-string-to-numeric coercion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    projectFirst.mockResolvedValue({ id: 'proj-1', user_id: 'user-1' });
    counterFirst.mockResolvedValue({
      id: 'ctr-1',
      project_id: 'proj-1',
      current_value: 7,
      min_value: 0,
      max_value: 100,
    });
    counterUpdateReturning.mockResolvedValue([{ id: 'ctr-1' }]);
  });

  it('coerces empty target/min/max/increment_by to null on update', async () => {
    const res = makeRes();
    await updateCounter(
      makeReq(
        {
          targetValue: '',
          incrementBy: '',
          minValue: '',
          maxValue: '',
        },
        { id: 'proj-1', counterId: 'ctr-1' },
      ),
      res,
    );

    const payload = counterUpdateSpy.mock.calls[0][0];
    expect(payload.target_value).toBeNull();
    expect(payload.increment_by).toBeNull();
    expect(payload.min_value).toBeNull();
    expect(payload.max_value).toBeNull();
  });

  it('does not write current_value when an empty string is sent (preserves prior value)', async () => {
    const res = makeRes();
    await updateCounter(
      makeReq(
        { currentValue: '' },
        { id: 'proj-1', counterId: 'ctr-1' },
      ),
      res,
    );

    const payload = counterUpdateSpy.mock.calls[0][0];
    // Empty input means "no change" — current_value should not be in the
    // update payload, so the existing value (7) is preserved.
    expect('current_value' in payload).toBe(false);
  });

  it('parses numeric currentValue updates', async () => {
    const res = makeRes();
    await updateCounter(
      makeReq(
        { currentValue: '12' },
        { id: 'proj-1', counterId: 'ctr-1' },
      ),
      res,
    );

    const payload = counterUpdateSpy.mock.calls[0][0];
    expect(payload.current_value).toBe(12);
  });
});
