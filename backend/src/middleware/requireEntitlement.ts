import { Request, Response, NextFunction } from 'express';
import { canUsePaidWorkspaceForReq } from '../utils/entitlement';

/**
 * Gate a route on `canUsePaidWorkspace`. Must run AFTER `authenticate`
 * so `req.user` is populated.
 *
 * On deny we return HTTP 402 (Payment Required) so the frontend can
 * branch on `error.response.status === 402` and open the upgrade
 * prompt without parsing string messages. The body shape matches the
 * rest of the API:
 *
 *   {
 *     success: false,
 *     message: 'Paid workspace required',
 *     error: 'PAYMENT_REQUIRED',
 *     reason: 'no_active_subscription' | 'no_subscription' | ...
 *   }
 */
export async function requireEntitlement(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const result = await canUsePaidWorkspaceForReq(req);
  if (result.allowed) {
    next();
    return;
  }

  res.status(402).json({
    success: false,
    message: 'Paid workspace required',
    error: 'PAYMENT_REQUIRED',
    reason: result.reason,
  });
}
