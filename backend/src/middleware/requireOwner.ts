import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../utils/errorHandler';

// Comma-separated allowlist of emails permitted to call owner-only
// endpoints (founder-facing reporting, admin tooling). Read at request
// time so a config change doesn't require restart in dev.
function ownerEmails(): Set<string> {
  const raw = process.env.OWNER_EMAIL ?? '';
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Gate a route so only the configured OWNER_EMAIL(s) can hit it. Must
 * follow `authenticate` so `req.user` is populated.
 *
 * Returns 403 (not 404) by design — the existence of the route is fine
 * to leak; the data behind it isn't.
 */
export function requireOwner(req: Request, _res: Response, next: NextFunction): void {
  const email = req.user?.email?.toLowerCase();
  const allowed = ownerEmails();
  if (!email || allowed.size === 0 || !allowed.has(email)) {
    throw new ForbiddenError('Owner access only');
  }
  next();
}
