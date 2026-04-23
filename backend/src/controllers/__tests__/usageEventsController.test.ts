/**
 * Unit tests for usageEventsController.
 *
 * We mock the knex db module so the controller's query-builder calls resolve
 * predictably, then run the controller directly with a stub req/res.
 */

jest.mock('../../config/database', () => {
  const insertReturning = jest.fn();
  const builder: any = {
    insert: jest.fn().mockReturnThis(),
    returning: insertReturning,
    whereRaw: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    count: jest.fn().mockReturnThis(),
    countDistinct: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockResolvedValue([
      { event_name: 'a', events: '3', users: '2' },
      { event_name: 'b', events: 0, users: 0 },
    ]),
  };
  const dbFn = jest.fn(() => builder);
  (dbFn as any).__builder = builder;
  (dbFn as any).__insertReturning = insertReturning;
  return { default: dbFn, __esModule: true };
});

jest.mock('../../config/logger', () => ({
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
  __esModule: true,
}));

import { createUsageEvent, getUsageSummary } from '../usageEventsController';
import db from '../../config/database';

const mockedDb = db as unknown as {
  __insertReturning: jest.Mock;
  __builder: { orderBy: jest.Mock };
};

function makeReq(body: any = {}, query: any = {}): any {
  return { body, query, user: { userId: 'user-1' } };
}

function makeRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('createUsageEvent', () => {
  beforeEach(() => {
    mockedDb.__insertReturning.mockResolvedValue([{ id: 'row-1', created_at: new Date('2026-04-23') }]);
  });

  it('rejects missing eventName', async () => {
    await expect(createUsageEvent(makeReq({}), makeRes())).rejects.toThrow(/eventName/);
  });

  it('rejects non-snake_case eventName', async () => {
    await expect(
      createUsageEvent(makeReq({ eventName: 'BadCamelCase' }), makeRes()),
    ).rejects.toThrow(/eventName/);
  });

  it('rejects too-long eventName', async () => {
    const longName = 'a'.repeat(100);
    await expect(
      createUsageEvent(makeReq({ eventName: longName }), makeRes()),
    ).rejects.toThrow();
  });

  it('accepts a valid snake_case event', async () => {
    const res = makeRes();
    await createUsageEvent(
      makeReq({ eventName: 'gradient_designer_saved' }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it('accepts optional entityId and metadata', async () => {
    const res = makeRes();
    await createUsageEvent(
      makeReq({
        eventName: 'blog_import_pattern_saved',
        entityId: 'ptn-1',
        metadata: { source: 'test' },
      }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('getUsageSummary', () => {
  it('defaults to 14 days when no query provided', async () => {
    const res = makeRes();
    await getUsageSummary(makeReq({}, {}), res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ days: 14 }) }),
    );
  });

  it('respects the days parameter within [1,90]', async () => {
    const res = makeRes();
    await getUsageSummary(makeReq({}, { days: '30' }), res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ days: 30 }) }),
    );
  });

  it('clamps invalid values back to 14', async () => {
    const res = makeRes();
    await getUsageSummary(makeReq({}, { days: '9999' }), res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ days: 14 }) }),
    );
  });

  it('maps rows to camelCase with number counts', async () => {
    const res = makeRes();
    await getUsageSummary(makeReq({}, {}), res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data.summary).toEqual([
      { eventName: 'a', events: 3, uniqueUsers: 2 },
      { eventName: 'b', events: 0, uniqueUsers: 0 },
    ]);
  });
});
