"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.decodeToken = decodeToken;
exports.generateVerificationToken = generateVerificationToken;
exports.generateResetToken = generateResetToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const uuid_1 = require("uuid");
// Helper function to get required environment variable or fail
function getRequiredEnv(key) {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required environment variable: ${key}. Please set it in your .env file.`);
    }
    return value;
}
const JWT_SECRET = getRequiredEnv('JWT_SECRET');
const JWT_REFRESH_SECRET = getRequiredEnv('JWT_REFRESH_SECRET');
const JWT_EXPIRY = process.env.JWT_EXPIRY || '15m';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';
/**
 * Generate access token
 */
function generateAccessToken(payload) {
    return jsonwebtoken_1.default.sign({ ...payload, jti: (0, uuid_1.v4)() }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}
/**
 * Generate refresh token
 */
function generateRefreshToken(payload) {
    return jsonwebtoken_1.default.sign({ ...payload, jti: (0, uuid_1.v4)() }, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRY });
}
/**
 * Verify access token
 */
function verifyAccessToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch (error) {
        throw new Error('Invalid or expired token');
    }
}
/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET);
    }
    catch (error) {
        throw new Error('Invalid or expired refresh token');
    }
}
/**
 * Decode token without verification (for debugging)
 */
function decodeToken(token) {
    return jsonwebtoken_1.default.decode(token);
}
/**
 * Generate email verification token
 */
function generateVerificationToken() {
    return (0, uuid_1.v4)() + (0, uuid_1.v4)(); // Extra long token for email verification
}
/**
 * Generate password reset token
 */
function generateResetToken() {
    return (0, uuid_1.v4)() + (0, uuid_1.v4)(); // Extra long token for password reset
}
