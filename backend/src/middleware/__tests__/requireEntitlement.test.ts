/**
 * Tests for requireEntitlement middleware. Mocks the entitlement
 * helper so we can drive each branch without spinning up the billing
 * service.
 */

const mockCanUse = jest.fn();
jest.mock('../../utils/entitlement', () => ({
  canUsePaidWorkspaceForReq: (...args: any[]) => mockCanUse(...args),
  __esModule: true,
}));

import type { Request, Response, NextFunction } from 'express';
import { requireEntitlement } from '../requireEntitlement';

function makeRes(): Response {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

describe('requireEntitlement', () => {
  beforeEach(() => mockCanUse.mockReset());

  it('calls next() when entitled', async () => {
    mockCanUse.mockResolvedValueOnce({ allowed: true, reason: 'owner' });
    const req = { user: { userId: 'u', email: 'o@x.test' } } as unknown as Request;
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    await requireEntitlement(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 402 with the reason when not entitled', async () => {
    mockCanUse.mockResolvedValueOnce({
      allowed: false,
      reason: 'no_active_subscription',
    });
    const req = { user: { userId: 'u', email: 'a@b.c' } } as unknown as Request;
    const res = makeRes();
    const next = jest.fn() as NextFunction;
    await requireEntitlement(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(402);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Paid workspace required',
      error: 'PAYMENT_REQUIRED',
      reason: 'no_active_subscription',
    });
  });
});
