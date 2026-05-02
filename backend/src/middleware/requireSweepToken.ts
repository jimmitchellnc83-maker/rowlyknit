import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ForbiddenError } from '../utils/errorHandler';

/**
 * Gate machine-to-machine endpoints (cron sweeps, scheduled jobs) on a
 * shared secret in `Authorization: Bearer <GDPR_SWEEP_TOKEN>`. Different
 * from `requireOwner` which expects a logged-in human owner — this path
 * is for GitHub Actions curl-ing the API on a schedule, with no user
 * session attached.
 *
 * Returns 403 (not 404) so a misconfigured workflow surfaces a clear
 * error in the runner logs rather than looking like a routing typo.
 *
 * The compare is constant-time to keep the surface boring against an
 * attacker who can guess the env-var name and try to time-side-channel
 * the value byte-by-byte.
 */
export function requireSweepToken(req: Request, _res: Response, next: NextFunction): void {
  const expected = process.env.GDPR_SWEEP_TOKEN;
  if (!expected) {
    throw new ForbiddenError('Sweep endpoint not configured');
  }

  const header = req.header('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  const provided = match?.[1] ?? '';

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new ForbiddenError('Invalid sweep token');
  }

  next();
}
