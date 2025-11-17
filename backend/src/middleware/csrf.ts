import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import logger from '../config/logger';

/**
 * Modern CSRF Protection Middleware
 * Implements double-submit cookie pattern
 * Protects against Cross-Site Request Forgery attacks
 */

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = '_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';

/**
 * Generate a cryptographically secure CSRF token
 */
function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * CSRF Protection Middleware
 * Validates CSRF token from request header/body against cookie
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF for safe methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Get token from header or body
  const tokenFromRequest = req.headers[CSRF_HEADER_NAME] as string || req.body?._csrf;
  const tokenFromCookie = req.signedCookies[CSRF_COOKIE_NAME];

  // Validate token
  if (!tokenFromRequest || !tokenFromCookie) {
    logger.warn('CSRF token missing', {
      ip: req.ip,
      path: req.path,
      method: req.method,
      hasRequestToken: !!tokenFromRequest,
      hasCookieToken: !!tokenFromCookie,
    });

    return res.status(403).json({
      success: false,
      message: 'CSRF token missing',
      error: 'CSRF_TOKEN_MISSING',
    });
  }

  // Compare tokens using constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(tokenFromRequest), Buffer.from(tokenFromCookie))) {
    logger.warn('CSRF token validation failed', {
      ip: req.ip,
      path: req.path,
      method: req.method,
    });

    return res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
      error: 'CSRF_VALIDATION_FAILED',
    });
  }

  next();
}

/**
 * Attach CSRF token to response
 * This makes the token available to the frontend
 */
export function attachCsrfToken(req: Request, res: Response, next: NextFunction) {
  // Generate new token if it doesn't exist
  let token = req.signedCookies[CSRF_COOKIE_NAME];

  if (!token) {
    token = generateCsrfToken();

    // Set as signed HTTP-only cookie
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3600000, // 1 hour
      signed: true,
    });
  }

  // Make token available in response locals
  res.locals.csrfToken = token;

  // Attach method to get token
  (req as any).csrfToken = () => token;

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
 * Catches CSRF-related errors
 */
export function csrfErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  if (err.code === 'EBADCSRFTOKEN' || err.error === 'CSRF_VALIDATION_FAILED' || err.error === 'CSRF_TOKEN_MISSING') {
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
  // First, always attach CSRF token (for GET requests to fetch the token)
  attachCsrfToken(req, res, () => {
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
      return next();
    }

    // Apply CSRF validation for session-based routes with unsafe methods
    return csrfProtection(req, res, next);
  });
}
