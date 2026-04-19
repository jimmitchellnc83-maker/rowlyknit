import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';
import { ForbiddenError } from '../utils/errorHandler';

/**
 * Strict same-origin guard for routes that set session cookies but are
 * intentionally exempt from CSRF token validation (login, refresh).
 *
 * Login CSRF: a cross-site form that auto-submits to /api/auth/login would
 * let an attacker log a victim's browser into the attacker's account.
 * Since login has no prior CSRF token to submit, we fall back to verifying
 * the request's Origin (or Referer, when Origin is absent) against the
 * CORS allowlist.
 */

function parseAllowedOrigins(): string[] {
  return (process.env.ALLOWED_ORIGINS || process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function requireSameOrigin(req: Request, res: Response, next: NextFunction): void {
  const allowedOrigins = parseAllowedOrigins();

  // If no allowlist is configured, fail closed. This matches the CORS policy
  // at app.ts and prevents a misconfiguration from silently weakening the check.
  if (allowedOrigins.length === 0) {
    logger.error('requireSameOrigin: ALLOWED_ORIGINS not configured; rejecting', {
      path: req.path,
      method: req.method,
    });
    return next(new ForbiddenError('Server origin allowlist not configured'));
  }

  const origin = req.get('origin');
  const referer = req.get('referer');

  // Browsers omit Origin on same-origin navigations in some cases, so fall
  // back to Referer. If both are missing, the request is not from a browser
  // (or the browser scrubbed them) — reject rather than assume safety.
  const source = origin || referer;
  if (!source) {
    logger.warn('requireSameOrigin: no Origin or Referer header', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });
    return next(new ForbiddenError('Missing Origin header'));
  }

  // Origin header is exact. Referer may include path + query, so match by prefix.
  const matched = origin
    ? allowedOrigins.includes(origin)
    : allowedOrigins.some((allowed) => source.startsWith(allowed + '/') || source === allowed);

  if (!matched) {
    logger.warn('requireSameOrigin: source not on allowlist', {
      ip: req.ip,
      origin,
      referer,
      path: req.path,
    });
    return next(new ForbiddenError('Origin not allowed'));
  }

  return next();
}
