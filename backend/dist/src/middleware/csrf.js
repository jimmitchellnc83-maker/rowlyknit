"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfProtection = csrfProtection;
exports.attachCsrfToken = attachCsrfToken;
exports.sendCsrfToken = sendCsrfToken;
exports.csrfErrorHandler = csrfErrorHandler;
exports.conditionalCsrf = conditionalCsrf;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = __importDefault(require("../config/logger"));
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
function generateCsrfToken() {
    return crypto_1.default.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}
/**
 * CSRF Protection Middleware
 * Validates CSRF token from request header/body against cookie
 */
function csrfProtection(req, res, next) {
    // Skip CSRF for safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    // Get token from header or body
    const tokenFromRequest = req.headers[CSRF_HEADER_NAME] || req.body?._csrf;
    const tokenFromCookie = req.signedCookies[CSRF_COOKIE_NAME];
    // Validate token
    if (!tokenFromRequest || !tokenFromCookie) {
        logger_1.default.warn('CSRF token missing', {
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
    if (!crypto_1.default.timingSafeEqual(Buffer.from(tokenFromRequest), Buffer.from(tokenFromCookie))) {
        logger_1.default.warn('CSRF token validation failed', {
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
function attachCsrfToken(req, res, next) {
    // Generate new token if it doesn't exist
    let token = req.signedCookies[CSRF_COOKIE_NAME];
    if (!token) {
        token = generateCsrfToken();
        const isProduction = process.env.NODE_ENV === 'production';
        const sameSite = process.env.COOKIE_SAMESITE
            || (isProduction ? 'none' : 'lax');
        const cookieDomain = process.env.COOKIE_DOMAIN;
        // Set as signed HTTP-only cookie
        res.cookie(CSRF_COOKIE_NAME, token, {
            httpOnly: true,
            secure: isProduction || sameSite === 'none',
            sameSite,
            maxAge: 3600000, // 1 hour
            signed: true,
            ...(cookieDomain ? { domain: cookieDomain } : {}),
            path: '/',
        });
    }
    // Make token available in response locals
    res.locals.csrfToken = token;
    // Attach method to get token
    req.csrfToken = () => token;
    next();
}
/**
 * Send CSRF token to client
 * Use this endpoint to get a fresh CSRF token
 */
function sendCsrfToken(req, res) {
    const token = req.csrfToken();
    res.json({
        success: true,
        csrfToken: token,
    });
}
/**
 * CSRF error handler
 * Catches CSRF-related errors
 */
function csrfErrorHandler(err, req, res, next) {
    if (err.code === 'EBADCSRFTOKEN' || err.error === 'CSRF_VALIDATION_FAILED' || err.error === 'CSRF_TOKEN_MISSING') {
        logger_1.default.warn('CSRF error caught by error handler', {
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
function conditionalCsrf(req, res, next) {
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
