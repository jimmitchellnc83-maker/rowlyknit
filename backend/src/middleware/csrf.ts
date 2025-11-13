import { Request, Response, NextFunction } from 'express';
import csrf from 'csurf';
import logger from '../config/logger';

/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */

// Create CSRF middleware with cookie storage
export const csrfProtection = csrf({
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', // Changed from 'strict' to 'lax' for better compatibility
    maxAge: 3600000, // 1 hour
  },
});

/**
 * Attach CSRF token to response
 * This makes the token available to the frontend
 */
export function attachCsrfToken(req: Request, res: Response, next: NextFunction) {
  res.locals.csrfToken = (req as any).csrfToken?.() || '';
  next();
}

/**
 * Send CSRF token to client
 * Use this endpoint to get a fresh CSRF token
 */
export function sendCsrfToken(req: Request, res: Response) {
  const token = (req as any).csrfToken();

  res.json({
    success: true,
    csrfToken: token,
  });
}

/**
 * CSRF error handler
 */
export function csrfErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err.code === 'EBADCSRFTOKEN') {
    logger.warn('CSRF token validation failed', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });

    res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
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
  // Skip CSRF for:
  // - Health checks
  // - Webhook endpoints
  // - API endpoints using JWT authentication
  const skipPaths = [
    '/health',
    '/api/webhooks',
  ];

  // Check if JWT is present (API authentication)
  const hasJWT = req.headers.authorization?.startsWith('Bearer ');

  if (skipPaths.some(path => req.path.startsWith(path)) || hasJWT) {
    return next();
  }

  // Apply CSRF protection for session-based routes
  return csrfProtection(req as any, res as any, next);
}
