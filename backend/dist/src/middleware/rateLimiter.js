"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordResetLimiter = exports.uploadLimiter = exports.authLimiter = exports.apiLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const rate_limit_redis_1 = __importDefault(require("rate-limit-redis"));
const redis_1 = require("../config/redis");
/**
 * General API rate limiter - 100 requests per minute
 */
exports.apiLimiter = (0, express_rate_limit_1.default)({
    store: new rate_limit_redis_1.default({
        sendCommand: ((...args) => redis_1.redisClient.call(args[0], ...args.slice(1))),
    }),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
    message: {
        success: false,
        message: 'Too many requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP
        return req.user?.userId || req.ip || 'unknown';
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/health' || req.path === '/api/health';
    },
});
/**
 * Strict rate limiter for authentication endpoints - 5 requests per minute
 */
exports.authLimiter = (0, express_rate_limit_1.default)({
    store: new rate_limit_redis_1.default({
        sendCommand: ((...args) => redis_1.redisClient.call(args[0], ...args.slice(1))),
    }),
    windowMs: 60000, // 1 minute
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '5'),
    message: {
        success: false,
        message: 'Too many authentication attempts, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use IP for auth endpoints
        return req.ip || 'unknown';
    },
    skipSuccessfulRequests: true, // Don't count successful logins
});
/**
 * File upload rate limiter - 20 requests per hour
 */
exports.uploadLimiter = (0, express_rate_limit_1.default)({
    store: new rate_limit_redis_1.default({
        sendCommand: ((...args) => redis_1.redisClient.call(args[0], ...args.slice(1))),
    }),
    windowMs: 3600000, // 1 hour
    max: parseInt(process.env.UPLOAD_RATE_LIMIT_MAX || '20'),
    message: {
        success: false,
        message: 'Too many upload requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.user?.userId || req.ip || 'unknown';
    },
});
/**
 * Password reset rate limiter - 3 requests per hour
 */
exports.passwordResetLimiter = (0, express_rate_limit_1.default)({
    store: new rate_limit_redis_1.default({
        sendCommand: ((...args) => redis_1.redisClient.call(args[0], ...args.slice(1))),
    }),
    windowMs: 3600000, // 1 hour
    max: 3,
    message: {
        success: false,
        message: 'Too many password reset requests, please try again later',
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        return req.body.email || req.ip || 'unknown';
    },
});
