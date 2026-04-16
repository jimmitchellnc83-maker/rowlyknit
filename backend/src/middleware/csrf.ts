import { Request, Response, NextFunction } from 'express';
import { doubleCsrf } from 'csrf-csrf';
import logger from '../config/logger';

/**
 * CSRF Protection Middleware
 * Uses csrf-csrf (double-submit cookie pattern) — actively maintained
 * replacement for the deprecated csurf package.
 */

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET!,
  getSessionIdentifier: (req) => req.ip || 'unknown',
  cookieName: '__csrf',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' as const : 'lax' as const,
    httpOnly: true,
    path: '/',
  },
  getCsrfTokenFromRequest: (req: Request) => {
    return (req.headers['x-csrf-token'] as string) || req.body?._csrf;
  },
});

/**
 * Send CSRF token to client
 */
export function sendCsrfToken(req: Request, res: Response) {
  const token = generateCsrfToken(req, res);
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

  const hasJWT = req.headers.authorization?.startsWith('Bearer ');
  const isSafeMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);

  if (skipPaths.some(path => req.path.startsWith(path)) || hasJWT || isSafeMethod) {
    // Generate a token on GET so the client can fetch it
    if (isSafeMethod) {
      try {
        generateCsrfToken(req, res, { overwrite: true });
      } catch {
        // Token generation failure on GET is non-fatal
      }
    }
    return next();
  }

  return doubleCsrfProtection(req, res, next);
}
