"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfProtection = void 0;
exports.attachCsrfToken = attachCsrfToken;
exports.sendCsrfToken = sendCsrfToken;
exports.csrfErrorHandler = csrfErrorHandler;
exports.conditionalCsrf = conditionalCsrf;
const csurf_1 = __importDefault(require("csurf"));
const logger_1 = __importDefault(require("../config/logger"));
/**
 * CSRF Protection Middleware
 * Protects against Cross-Site Request Forgery attacks
 */
// Create CSRF middleware with cookie storage
exports.csrfProtection = (0, csurf_1.default)({
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
function attachCsrfToken(req, res, next) {
    res.locals.csrfToken = req.csrfToken?.() || '';
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
 */
function csrfErrorHandler(err, req, res, next) {
    if (err.code === 'EBADCSRFTOKEN') {
        logger_1.default.warn('CSRF token validation failed', {
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
function conditionalCsrf(req, res, next) {
    // Skip CSRF for:
    // - Health checks
    // - Webhook endpoints
    // - Auth endpoints (login, register) - protected by rate limiting instead
    // - API endpoints using JWT authentication
    const skipPaths = [
        '/health',
        '/api/webhooks',
        '/api/auth/login',
        '/api/auth/register',
        '/api/auth/refresh',
        '/api/auth/forgot-password',
        '/api/auth/reset-password',
    ];
    // Check if JWT is present (API authentication)
    const hasJWT = req.headers.authorization?.startsWith('Bearer ');
    if (skipPaths.some(path => req.path.startsWith(path)) || hasJWT) {
        return next();
    }
    // Apply CSRF protection for session-based routes
    return (0, exports.csrfProtection)(req, res, next);
}
