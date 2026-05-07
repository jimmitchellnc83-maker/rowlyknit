/**
 * Tests for the first-party public analytics endpoint.
 *
 * The endpoint is critical to dashboard fidelity (`/admin/business`
 * funnel reads `usage_events`), so we pin its contract:
 *  - Anonymous events insert with user_id NULL.
 *  - Disallowed event names → 400.
 *  - Metadata is sanitised against an allowlist (PII keys dropped).
 *  - DB failure logs a warning but does not throw (telemetry must
 *    never take a public calculator down).
 */

const dbMock: any = jest.fn();

jest.mock('../../config/database', () => ({
  default: dbMock,
  __esModule: true,
}));

jest.mock('../../config/logger', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  __esModule: true,
}));

jest.mock('../../utils/jwt', () => ({
  verifyAccessToken: jest.fn((token: string) => {
    if (token === 'good-token') return { userId: 'user-123' };
    throw new Error('Invalid token');
  }),
}));

import type { Request, Response } from 'express';
import {
  recordPublicEvent,
  PUBLIC_ANALYTICS_EVENT_ALLOWLIST,
} from '../publicAnalyticsController';
import { ValidationError } from '../../utils/errorHandler';

function makeReq(opts: Partial<Request> = {}): Request {
  return {
    body: {},
    headers: {},
    cookies: {},
    ...opts,
  } as unknown as Request;
}

function makeRes(): Response & { __json: any; __status: number; __headers: Record<string, string> } {
  const res: any = {
    __status: 200,
    __json: undefined,
    __headers: {},
  };
  res.status = jest.fn((code: number) => {
    res.__status = code;
    return res;
  });
  res.json = jest.fn((body: any) => {
    res.__json = body;
    return res;
  });
  res.set = jest.fn((header: string, value: string) => {
    res.__headers[header] = value;
    return res;
  });
  return res;
}

beforeEach(() => {
  dbMock.mockReset();
});

describe('recordPublicEvent', () => {
  it('rejects an event name that is not in the allowlist', async () => {
    const req = makeReq({ body: { eventName: 'arbitrary_admin_action' } });
    const res = makeRes();
    await expect(recordPublicEvent(req, res)).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects a malformed event name (not snake_case)', async () => {
    const req = makeReq({ body: { eventName: 'Bad-Event-Name' } });
    const res = makeRes();
    await expect(recordPublicEvent(req, res)).rejects.toBeInstanceOf(ValidationError);
  });

  it('records an anonymous public_tool_viewed event with user_id=null', async () => {
    let inserted: any;
    dbMock.mockImplementation((table: string) => {
      expect(table).toBe('usage_events');
      return {
        insert: jest.fn(async (row: any) => {
          inserted = row;
          return [];
        }),
      };
    });

    const req = makeReq({
      body: {
        eventName: 'public_tool_viewed',
        metadata: { route: '/calculators/gauge' },
      },
    });
    const res = makeRes();
    await recordPublicEvent(req, res);

    expect(res.__status).toBe(202);
    expect(res.__json).toEqual({ success: true });
    expect(inserted).toBeDefined();
    expect(inserted.user_id).toBeNull();
    expect(inserted.event_name).toBe('public_tool_viewed');
    const meta = JSON.parse(inserted.metadata);
    expect(meta).toEqual({ route: '/calculators/gauge' });
  });

  it('records the user_id when a valid Bearer token is present', async () => {
    let inserted: any;
    dbMock.mockImplementation(() => ({
      insert: jest.fn(async (row: any) => {
        inserted = row;
        return [];
      }),
    }));

    const req = makeReq({
      headers: { authorization: 'Bearer good-token' },
      body: {
        eventName: 'save_to_rowly_clicked',
        metadata: { tool: 'gauge', auth: 'in' },
      },
    });
    const res = makeRes();
    await recordPublicEvent(req, res);

    expect(inserted.user_id).toBe('user-123');
    const meta = JSON.parse(inserted.metadata);
    expect(meta.tool).toBe('gauge');
    expect(meta.auth).toBe('in');
  });

  it('falls back to anonymous when the Bearer token is invalid (still records the event)', async () => {
    let inserted: any;
    dbMock.mockImplementation(() => ({
      insert: jest.fn(async (row: any) => {
        inserted = row;
        return [];
      }),
    }));

    const req = makeReq({
      headers: { authorization: 'Bearer bad-token' },
      body: {
        eventName: 'public_tool_viewed',
        metadata: { route: '/calculators/size' },
      },
    });
    const res = makeRes();
    await recordPublicEvent(req, res);
    expect(inserted.user_id).toBeNull();
    expect(res.__status).toBe(202);
  });

  it('drops disallowed metadata keys (PII protection)', async () => {
    let inserted: any;
    dbMock.mockImplementation(() => ({
      insert: jest.fn(async (row: any) => {
        inserted = row;
        return [];
      }),
    }));

    const req = makeReq({
      body: {
        eventName: 'public_tool_viewed',
        metadata: {
          route: '/calculators/yardage',
          email: 'user@example.com',         // disallowed
          ip: '203.0.113.5',                  // disallowed
          credit_card: '4111111111111111',    // disallowed
          tool: 'yardage',                    // allowed
        },
      },
    });
    const res = makeRes();
    await recordPublicEvent(req, res);

    const meta = JSON.parse(inserted.metadata);
    expect(meta).toEqual({
      route: '/calculators/yardage',
      tool: 'yardage',
    });
    expect(meta.email).toBeUndefined();
    expect(meta.ip).toBeUndefined();
    expect(meta.credit_card).toBeUndefined();
  });

  it('coerces numeric metadata values to strings', async () => {
    let inserted: any;
    dbMock.mockImplementation(() => ({
      insert: jest.fn(async (row: any) => {
        inserted = row;
        return [];
      }),
    }));

    const req = makeReq({
      body: {
        eventName: 'public_tool_used',
        metadata: { route: '/calculators/size', size: 42 },
      },
    });
    const res = makeRes();
    await recordPublicEvent(req, res);
    const meta = JSON.parse(inserted.metadata);
    expect(meta.size).toBe('42');
  });

  it('returns 202 even when the DB insert throws (telemetry never breaks the page)', async () => {
    dbMock.mockImplementation(() => ({
      insert: jest.fn(async () => {
        throw new Error('DB unavailable');
      }),
    }));

    const req = makeReq({
      body: { eventName: 'public_tool_viewed', metadata: { route: '/calculators' } },
    });
    const res = makeRes();
    await recordPublicEvent(req, res);
    expect(res.__status).toBe(202);
    expect(res.__json).toEqual({ success: true });
  });

  it('sets Cache-Control: no-store so the response is never cached', async () => {
    dbMock.mockImplementation(() => ({
      insert: jest.fn(async () => []),
    }));
    const req = makeReq({
      body: { eventName: 'public_tool_viewed', metadata: { route: '/calculators' } },
    });
    const res = makeRes();
    await recordPublicEvent(req, res);
    expect(res.__headers['Cache-Control']).toBe('no-store');
  });

  it('exposes a fixed allowlist that includes the dashboard funnel events', () => {
    expect(PUBLIC_ANALYTICS_EVENT_ALLOWLIST.has('public_tool_viewed')).toBe(true);
    expect(PUBLIC_ANALYTICS_EVENT_ALLOWLIST.has('public_tool_used')).toBe(true);
    expect(PUBLIC_ANALYTICS_EVENT_ALLOWLIST.has('save_to_rowly_clicked')).toBe(true);
    expect(PUBLIC_ANALYTICS_EVENT_ALLOWLIST.has('upgrade_page_viewed')).toBe(true);
    expect(PUBLIC_ANALYTICS_EVENT_ALLOWLIST.has('checkout_started')).toBe(true);
    expect(PUBLIC_ANALYTICS_EVENT_ALLOWLIST.has('checkout_completed')).toBe(true);
    expect(PUBLIC_ANALYTICS_EVENT_ALLOWLIST.has('trial_started')).toBe(true);
  });
});
