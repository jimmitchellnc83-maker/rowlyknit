"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.refreshToken = refreshToken;
exports.logout = logout;
exports.getProfile = getProfile;
exports.verifyEmail = verifyEmail;
exports.requestPasswordReset = requestPasswordReset;
exports.resetPassword = resetPassword;
const database_1 = __importDefault(require("../config/database"));
const password_1 = require("../utils/password");
const jwt_1 = require("../utils/jwt");
const errorHandler_1 = require("../utils/errorHandler");
const emailService_1 = __importDefault(require("../services/emailService"));
const auditLog_1 = require("../middleware/auditLog");
const validator_1 = __importDefault(require("validator"));
/**
 * Register a new user
 */
async function register(req, res) {
    const { email, password, firstName, lastName } = req.body;
    // Validate email
    if (!validator_1.default.isEmail(email)) {
        throw new errorHandler_1.ValidationError('Invalid email address');
    }
    // Validate password strength
    const passwordValidation = (0, password_1.validatePasswordStrength)(password);
    if (!passwordValidation.valid) {
        throw new errorHandler_1.ValidationError('Password does not meet requirements', passwordValidation.errors);
    }
    // Check if user already exists
    const existingUser = await (0, database_1.default)('users').where({ email }).first();
    if (existingUser) {
        throw new errorHandler_1.ConflictError('User with this email already exists');
    }
    // Hash password
    const passwordHash = await (0, password_1.hashPassword)(password);
    // Generate verification token
    const verificationToken = (0, jwt_1.generateVerificationToken)();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    // Create user
    const [user] = await (0, database_1.default)('users')
        .insert({
        email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        verification_token: verificationToken,
        verification_token_expires: verificationExpires,
        created_at: new Date(),
        updated_at: new Date(),
    })
        .returning(['id', 'email', 'first_name', 'last_name', 'created_at']);
    // Send verification email
    const verificationUrl = `${process.env.APP_URL}/verify-email?token=${verificationToken}`;
    await emailService_1.default.sendWelcomeEmail(email, firstName || 'there', verificationUrl);
    // Log audit
    await (0, auditLog_1.createAuditLog)(req, {
        userId: user.id,
        action: 'user_registered',
        entityType: 'user',
        entityId: user.id,
        newValues: { email, firstName, lastName },
    });
    res.status(201).json({
        success: true,
        message: 'Registration successful. Please check your email to verify your account.',
        data: {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
            },
        },
    });
}
/**
 * Login user
 */
async function login(req, res) {
    const { email, password, rememberMe } = req.body;
    // Find user
    const user = await (0, database_1.default)('users')
        .where({ email })
        .whereNull('deleted_at')
        .first();
    if (!user) {
        throw new errorHandler_1.UnauthorizedError('Invalid email or password');
    }
    // Check if user is active
    if (!user.is_active) {
        throw new errorHandler_1.UnauthorizedError('Account is inactive');
    }
    // Verify password
    const isPasswordValid = await (0, password_1.comparePassword)(password, user.password_hash);
    if (!isPasswordValid) {
        throw new errorHandler_1.UnauthorizedError('Invalid email or password');
    }
    // Generate tokens
    const accessToken = (0, jwt_1.generateAccessToken)({
        userId: user.id,
        email: user.email,
    });
    // Create session
    const refreshToken = (0, jwt_1.generateRefreshToken)({
        userId: user.id,
        sessionId: '',
    });
    // Set session expiry based on "Remember Me"
    // Remember Me: 30 days, Regular: 7 days
    const sessionDays = rememberMe ? 30 : 7;
    const sessionExpires = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);
    const [session] = await (0, database_1.default)('sessions')
        .insert({
        user_id: user.id,
        refresh_token: refreshToken,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        expires_at: sessionExpires,
        created_at: new Date(),
        updated_at: new Date(),
    })
        .returning('*');
    // Update last login
    await (0, database_1.default)('users').where({ id: user.id }).update({
        last_login: new Date(),
        updated_at: new Date(),
    });
    // Set cookies
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax', // Changed from 'strict' to 'lax' for cross-origin cookies
    };
    res.cookie('accessToken', accessToken, {
        ...cookieOptions,
        maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refreshToken', refreshToken, {
        ...cookieOptions,
        maxAge: sessionDays * 24 * 60 * 60 * 1000, // 7 or 30 days based on Remember Me
    });
    // Log audit
    await (0, auditLog_1.createAuditLog)(req, {
        userId: user.id,
        action: 'user_login',
        entityType: 'user',
        entityId: user.id,
    });
    res.json({
        success: true,
        message: 'Login successful',
        data: {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                emailVerified: user.email_verified,
            },
            accessToken,
            refreshToken,
        },
    });
}
/**
 * Refresh access token
 */
async function refreshToken(req, res) {
    const { refreshToken: token } = req.body || req.cookies;
    if (!token) {
        throw new errorHandler_1.UnauthorizedError('Refresh token required');
    }
    // Verify refresh token
    const payload = (0, jwt_1.verifyRefreshToken)(token);
    // Check if session exists and is valid
    const session = await (0, database_1.default)('sessions')
        .where({
        refresh_token: token,
        user_id: payload.userId,
        is_revoked: false,
    })
        .where('expires_at', '>', new Date())
        .first();
    if (!session) {
        throw new errorHandler_1.UnauthorizedError('Invalid or expired refresh token');
    }
    // Get user
    const user = await (0, database_1.default)('users')
        .where({ id: payload.userId, is_active: true })
        .whereNull('deleted_at')
        .first();
    if (!user) {
        throw new errorHandler_1.UnauthorizedError('User not found');
    }
    // Generate new access token
    const accessToken = (0, jwt_1.generateAccessToken)({
        userId: user.id,
        email: user.email,
    });
    // Update cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: { accessToken },
    });
}
/**
 * Logout user
 */
async function logout(req, res) {
    const userId = req.user?.userId;
    const { refreshToken } = req.cookies;
    if (refreshToken) {
        // Revoke session
        await (0, database_1.default)('sessions')
            .where({ refresh_token: refreshToken, user_id: userId })
            .update({ is_revoked: true, updated_at: new Date() });
    }
    // Clear cookies
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    // Log audit
    if (userId) {
        await (0, auditLog_1.createAuditLog)(req, {
            userId,
            action: 'user_logout',
            entityType: 'user',
            entityId: userId,
        });
    }
    res.json({
        success: true,
        message: 'Logout successful',
    });
}
/**
 * Get current user profile
 */
async function getProfile(req, res) {
    const userId = req.user?.userId;
    const user = await (0, database_1.default)('users')
        .where({ id: userId })
        .whereNull('deleted_at')
        .select('id', 'email', 'first_name', 'last_name', 'username', 'profile_image', 'email_verified', 'preferences', 'created_at')
        .first();
    if (!user) {
        throw new errorHandler_1.NotFoundError('User not found');
    }
    res.json({
        success: true,
        data: {
            user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                username: user.username,
                profileImage: user.profile_image,
                emailVerified: user.email_verified,
                preferences: user.preferences,
                createdAt: user.created_at,
            },
        },
    });
}
/**
 * Verify email
 */
async function verifyEmail(req, res) {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
        throw new errorHandler_1.ValidationError('Verification token required');
    }
    // Find user with token
    const user = await (0, database_1.default)('users')
        .where({ verification_token: token })
        .where('verification_token_expires', '>', new Date())
        .whereNull('deleted_at')
        .first();
    if (!user) {
        throw new errorHandler_1.ValidationError('Invalid or expired verification token');
    }
    // Update user
    await (0, database_1.default)('users')
        .where({ id: user.id })
        .update({
        email_verified: true,
        verification_token: null,
        verification_token_expires: null,
        updated_at: new Date(),
    });
    // Log audit
    await (0, auditLog_1.createAuditLog)(req, {
        userId: user.id,
        action: 'email_verified',
        entityType: 'user',
        entityId: user.id,
    });
    res.json({
        success: true,
        message: 'Email verified successfully',
    });
}
/**
 * Request password reset
 */
async function requestPasswordReset(req, res) {
    const { email } = req.body;
    const user = await (0, database_1.default)('users')
        .where({ email })
        .whereNull('deleted_at')
        .first();
    // Always return success to prevent email enumeration
    if (!user) {
        res.json({
            success: true,
            message: 'If an account exists with this email, a password reset link has been sent.',
        });
        return;
    }
    // Generate reset token
    const resetToken = (0, jwt_1.generateResetToken)();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    // Save token
    await (0, database_1.default)('users')
        .where({ id: user.id })
        .update({
        reset_password_token: resetToken,
        reset_password_expires: resetExpires,
        updated_at: new Date(),
    });
    // Send email
    const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
    await emailService_1.default.sendPasswordResetEmail(email, user.first_name || 'there', resetUrl);
    // Log audit
    await (0, auditLog_1.createAuditLog)(req, {
        userId: user.id,
        action: 'password_reset_requested',
        entityType: 'user',
        entityId: user.id,
    });
    res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
    });
}
/**
 * Reset password
 */
async function resetPassword(req, res) {
    const { token, password } = req.body;
    if (!token) {
        throw new errorHandler_1.ValidationError('Reset token required');
    }
    // Validate password
    const passwordValidation = (0, password_1.validatePasswordStrength)(password);
    if (!passwordValidation.valid) {
        throw new errorHandler_1.ValidationError('Password does not meet requirements', passwordValidation.errors);
    }
    // Find user with token
    const user = await (0, database_1.default)('users')
        .where({ reset_password_token: token })
        .where('reset_password_expires', '>', new Date())
        .whereNull('deleted_at')
        .first();
    if (!user) {
        throw new errorHandler_1.ValidationError('Invalid or expired reset token');
    }
    // Hash new password
    const passwordHash = await (0, password_1.hashPassword)(password);
    // Update user
    await (0, database_1.default)('users')
        .where({ id: user.id })
        .update({
        password_hash: passwordHash,
        reset_password_token: null,
        reset_password_expires: null,
        updated_at: new Date(),
    });
    // Revoke all sessions
    await (0, database_1.default)('sessions')
        .where({ user_id: user.id })
        .update({ is_revoked: true, updated_at: new Date() });
    // Log audit
    await (0, auditLog_1.createAuditLog)(req, {
        userId: user.id,
        action: 'password_reset',
        entityType: 'user',
        entityId: user.id,
    });
    res.json({
        success: true,
        message: 'Password reset successful. Please login with your new password.',
    });
}
