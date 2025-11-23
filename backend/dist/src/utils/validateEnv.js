"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEnvironmentVariables = validateEnvironmentVariables;
exports.validateSecretStrength = validateSecretStrength;
const logger_1 = __importDefault(require("../config/logger"));
const REQUIRED_ENV_VARS = [
    { name: 'NODE_ENV', required: true, description: 'Application environment (development/production)' },
    { name: 'PORT', required: true, description: 'Server port' },
    { name: 'JWT_SECRET', required: true, description: 'JWT signing secret' },
    { name: 'JWT_REFRESH_SECRET', required: true, description: 'JWT refresh token secret' },
    { name: 'CSRF_SECRET', required: true, description: 'CSRF protection secret' },
    { name: 'SESSION_SECRET', required: true, description: 'Session cookie secret' },
    { name: 'ALLOWED_ORIGINS', required: true, description: 'CORS allowed origins' },
];
const PRODUCTION_ENV_VARS = [
    { name: 'EMAIL_API_KEY', required: false, description: 'Email service API key (recommended for production)' },
    { name: 'SENTRY_DSN', required: false, description: 'Sentry error monitoring DSN (optional but recommended)' },
    { name: 'REDIS_PASSWORD', required: false, description: 'Redis password (recommended for production)' },
];
/**
 * Validates required environment variables on application startup
 * Throws error and prevents startup if critical variables are missing
 */
function validateEnvironmentVariables() {
    const errors = [];
    const warnings = [];
    const isProduction = process.env.NODE_ENV === 'production';
    // Check required variables
    REQUIRED_ENV_VARS.forEach(({ name, description }) => {
        if (!process.env[name]) {
            errors.push(`❌ Missing required environment variable: ${name} (${description})`);
        }
    });
    // Check production-specific variables
    if (isProduction) {
        PRODUCTION_ENV_VARS.forEach(({ name, required, description }) => {
            if (!process.env[name]) {
                if (required) {
                    errors.push(`❌ Missing required production variable: ${name} (${description})`);
                }
                else {
                    warnings.push(`⚠️  Missing recommended variable: ${name} (${description})`);
                }
            }
        });
    }
    // Log warnings
    if (warnings.length > 0) {
        logger_1.default.warn('Environment variable warnings:');
        warnings.forEach(warning => logger_1.default.warn(warning));
    }
    // Throw error if any required variables are missing
    if (errors.length > 0) {
        logger_1.default.error('❌ Environment variable validation failed:');
        errors.forEach(error => logger_1.default.error(error));
        logger_1.default.error('\n💡 Create a .env file based on .env.example and fill in all required values');
        throw new Error(`Missing ${errors.length} required environment variable(s). Application cannot start.`);
    }
    logger_1.default.info('✅ Environment variables validated successfully');
}
/**
 * Validates that critical secrets have sufficient length
 */
function validateSecretStrength() {
    const MIN_SECRET_LENGTH = 32;
    const warnings = [];
    const errors = [];
    const secretsToCheck = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'CSRF_SECRET', 'SESSION_SECRET'];
    secretsToCheck.forEach(secretName => {
        const secret = process.env[secretName];
        if (secret && secret.length < MIN_SECRET_LENGTH) {
            warnings.push(`⚠️  ${secretName} is too short (${secret.length} chars). Recommended: ${MIN_SECRET_LENGTH}+ characters`);
        }
    });
    // CRITICAL: JWT_SECRET and JWT_REFRESH_SECRET must be different
    if (process.env.JWT_SECRET && process.env.JWT_REFRESH_SECRET) {
        if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
            errors.push(`❌ SECURITY ERROR: JWT_SECRET and JWT_REFRESH_SECRET must be different!`);
            errors.push(`   Using the same secret for both tokens compromises security.`);
            errors.push(`   Generate different secrets using: openssl rand -base64 32`);
        }
    }
    if (warnings.length > 0) {
        logger_1.default.warn('Secret strength warnings:');
        warnings.forEach(warning => logger_1.default.warn(warning));
    }
    if (errors.length > 0) {
        logger_1.default.error('❌ Critical security error:');
        errors.forEach(error => logger_1.default.error(error));
        throw new Error('JWT secrets validation failed: JWT_SECRET and JWT_REFRESH_SECRET must be different');
    }
}
