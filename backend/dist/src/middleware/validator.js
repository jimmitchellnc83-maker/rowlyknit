"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
exports.sanitizeInput = sanitizeInput;
exports.validateUUID = validateUUID;
exports.validatePagination = validatePagination;
exports.validateSearch = validateSearch;
const express_validator_1 = require("express-validator");
const errorHandler_1 = require("../utils/errorHandler");
const validator_1 = __importDefault(require("validator"));
/**
 * Middleware to check validation results from express-validator
 */
function validate(req, res, next) {
    const errors = (0, express_validator_1.validationResult)(req);
    if (!errors.isEmpty()) {
        throw new errorHandler_1.ValidationError('Validation failed', errors.array());
    }
    next();
}
/**
 * Sanitize input to prevent XSS attacks
 */
function sanitizeInput(req, res, next) {
    // Sanitize body
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }
    // Sanitize query parameters
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }
    next();
}
/**
 * Recursively sanitize an object
 */
function sanitizeObject(obj) {
    if (typeof obj === 'string') {
        return validator_1.default.escape(obj.trim());
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
    }
    if (obj && typeof obj === 'object') {
        const sanitized = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                sanitized[key] = sanitizeObject(obj[key]);
            }
        }
        return sanitized;
    }
    return obj;
}
/**
 * Validate UUID parameter
 */
function validateUUID(paramName) {
    return (req, res, next) => {
        const value = req.params[paramName];
        if (!value || !validator_1.default.isUUID(value)) {
            throw new errorHandler_1.ValidationError(`Invalid ${paramName}: must be a valid UUID`);
        }
        next();
    };
}
/**
 * Validate pagination parameters
 */
function validatePagination(req, res, next) {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    if (page < 1) {
        throw new errorHandler_1.ValidationError('Page must be greater than 0');
    }
    if (limit < 1 || limit > 100) {
        throw new errorHandler_1.ValidationError('Limit must be between 1 and 100');
    }
    req.query.page = page.toString();
    req.query.limit = limit.toString();
    next();
}
/**
 * Validate and sanitize search query
 */
function validateSearch(req, res, next) {
    if (req.query.search) {
        const search = req.query.search;
        // Limit search query length
        if (search.length > 100) {
            throw new errorHandler_1.ValidationError('Search query must be less than 100 characters');
        }
        // Sanitize
        req.query.search = validator_1.default.escape(search.trim());
    }
    next();
}
