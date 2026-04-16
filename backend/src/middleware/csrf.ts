import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import logger from '../config/logger';

/**
 * CSRF Protection Middleware
 * Uses csrf-csrf (double-submit cookie pattern) — actively maintained
 * replacement for the deprecated csurf package.
 */

const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!,
  cookieName: '__csrf',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    httpOnly: true,
    signed: true,
    path: '/',
  },
  getTokenFromRequest: (req: Request) => {
    return (req.headers['x-csrf-token'] as string) || req.body?._csrf;
  },
});

/**
 * Send CSRF token to client
 */
export function sendCsrfToken(req: Request, res: Response) {
  const token = generateToken(req, res);
  res.json({
    success: true,
    csrfToken: token,
  });
}

/**
 * CSRF error handler
 */
export function csrfErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err.code === 'EBADCSRFTOKEN' || err.message?.includes('csrf') || err.message?.includes('CSRF')) {
    logger.warn('CSRF error caught by error handler', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      error: err.message,
    });

    res.status(403).json({
      success: false,
      message: 'CSRF validation failed',
      error: 'CSRF_VALIDATION_FAILED',
    });
    return;
  }

  next(err);
}

/**
 * Conditional CSRF protection
 * Skip CSRF for certain routes (like API endpoints using JWT)
 */
export function conditionalCsrf(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF validation for:
  // - Health checks
  // - Webhook endpoints
  // - Auth endpoints (login, register) - protected by rate limiting instead
  // - API endpoints using JWT authentication
  // - Safe methods (GET, HEAD, OPTIONS)
  const skipPaths = [
    '/health',
    '/metrics',
    '/api/webhooks',
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/auth/forgot-password',
    '/api/auth/reset-password',
    '/api/csrf-token',
  ];

  // Check if JWT is present (API authentication)
  const hasJWT = req.headers.authorization?.startsWith('Bearer ');

  // Skip validation for safe methods
  const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);

  if (skipPaths.some(path => req.path.startsWith(path)) || hasJWT || isSafeMethod) {
    // Still generate a token for GET requests so the client can fetch it
    if (isSafeMethod) {
      try {
        generateToken(req, res, true);
      } catch {
        // Token generation failure on GET is non-fatal
      }
    }
    return next();
  }

  // Apply csrf-csrf double-submit validation
  return doubleCsrfProtection(req, res, next);
}
