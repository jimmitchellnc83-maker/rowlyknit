"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.optionalAuthenticate = optionalAuthenticate;
const jwt_1 = require("../utils/jwt");
const errorHandler_1 = require("../utils/errorHandler");
const database_1 = __importDefault(require("../config/database"));
/**
 * Authentication middleware - verifies JWT token
 */
async function authenticate(req, res, next) {
    try {
        // Get token from Authorization header or cookie
        let token;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
        else if (req.cookies && req.cookies.accessToken) {
            token = req.cookies.accessToken;
        }
        if (!token) {
            throw new errorHandler_1.UnauthorizedError('No authentication token provided');
        }
        // Verify token
        const payload = (0, jwt_1.verifyAccessToken)(token);
        // Check if user exists and is active
        const user = await (0, database_1.default)('users')
            .where({ id: payload.userId, is_active: true })
            .whereNull('deleted_at')
            .first();
        if (!user) {
            throw new errorHandler_1.UnauthorizedError('User not found or inactive');
        }
        // Attach user to request
        req.user = payload;
        next();
    }
    catch (error) {
        if (error instanceof errorHandler_1.UnauthorizedError) {
            next(error);
        }
        else {
            next(new errorHandler_1.UnauthorizedError('Invalid authentication token'));
        }
    }
}
/**
 * Optional authentication - doesn't fail if no token
 */
async function optionalAuthenticate(req, res, next) {
    try {
        let token;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
        else if (req.cookies && req.cookies.accessToken) {
            token = req.cookies.accessToken;
        }
        if (token) {
            const payload = (0, jwt_1.verifyAccessToken)(token);
            const user = await (0, database_1.default)('users')
                .where({ id: payload.userId, is_active: true })
                .whereNull('deleted_at')
                .first();
            if (user) {
                req.user = payload;
            }
        }
        next();
    }
    catch (error) {
        // Continue without authentication
        next();
    }
}
