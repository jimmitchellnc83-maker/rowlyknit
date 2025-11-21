import { Request, Response } from 'express';
import db from '../config/database';
import { hashPassword, comparePassword, validatePasswordStrength } from '../utils/password';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateVerificationToken,
  generateResetToken,
} from '../utils/jwt';
import {
  UnauthorizedError,
  ValidationError,
  ConflictError,
  NotFoundError,
} from '../utils/errorHandler';
import emailService from '../services/emailService';
import { createAuditLog } from '../middleware/auditLog';
import validator from 'validator';

/**
 * Register a new user
 */
export async function register(req: Request, res: Response) {
  const { email, password, firstName, lastName } = req.body;

  // Validate email
  if (!validator.isEmail(email)) {
    throw new ValidationError('Invalid email address');
  }

  // Validate password strength
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    throw new ValidationError('Password does not meet requirements', passwordValidation.errors);
  }

  // Check if user already exists
  const existingUser = await db('users').where({ email }).first();
  if (existingUser) {
    throw new ConflictError('User with this email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Generate verification token
  const verificationToken = generateVerificationToken();
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Create user
  const [user] = await db('users')
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
  await emailService.sendWelcomeEmail(
    email,
    firstName || 'there',
    verificationUrl
  );

  // Log audit
  await createAuditLog(req, {
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
export async function login(req: Request, res: Response) {
  const { email, password, rememberMe } = req.body;

  // Find user
  const user = await db('users')
    .where({ email })
    .whereNull('deleted_at')
    .first();

  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Check if user is active
  if (!user.is_active) {
    throw new UnauthorizedError('Account is inactive');
  }

  // Verify password
  const isPasswordValid = await comparePassword(password, user.password_hash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Generate tokens
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
  });

  // Create session
  const refreshToken = generateRefreshToken({
    userId: user.id,
    sessionId: '',
  });

  // Set session expiry based on "Remember Me"
  // Remember Me: 30 days, Regular: 7 days
  const sessionDays = rememberMe ? 30 : 7;
  const sessionExpires = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);

  const [_session] = await db('sessions')
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
  await db('users').where({ id: user.id }).update({
    last_login: new Date(),
    updated_at: new Date(),
  });

  // Set cookies
  const isProduction = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const, // Use 'lax' for cross-origin cookie support
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
  await createAuditLog(req, {
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
export async function refreshToken(req: Request, res: Response) {
  const { refreshToken: token } = req.body || req.cookies;

  if (!token) {
    throw new UnauthorizedError('Refresh token required');
  }

  // Verify refresh token
  const payload = verifyRefreshToken(token);

  // Check if session exists and is valid
  const session = await db('sessions')
    .where({
      refresh_token: token,
      user_id: payload.userId,
      is_revoked: false,
    })
    .where('expires_at', '>', new Date())
    .first();

  if (!session) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  // Get user
  const user = await db('users')
    .where({ id: payload.userId, is_active: true })
    .whereNull('deleted_at')
    .first();

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  // Generate new access token
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
  });

  // Update cookie
  const isProduction = process.env.NODE_ENV === 'production';
  res.cookie('accessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax' as const, // Use 'lax' for cross-origin cookie support
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
export async function logout(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    // Revoke session
    await db('sessions')
      .where({ refresh_token: refreshToken, user_id: userId })
      .update({ is_revoked: true, updated_at: new Date() });
  }

  // Clear cookies
  res.clearCookie('accessToken');
  res.clearCookie('refreshToken');

  // Log audit
  if (userId) {
    await createAuditLog(req, {
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
export async function getProfile(req: Request, res: Response) {
  const userId = (req as any).user?.userId;

  const user = await db('users')
    .where({ id: userId })
    .whereNull('deleted_at')
    .select(
      'id',
      'email',
      'first_name',
      'last_name',
      'username',
      'profile_image',
      'email_verified',
      'preferences',
      'created_at'
    )
    .first();

  if (!user) {
    throw new NotFoundError('User not found');
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
export async function verifyEmail(req: Request, res: Response) {
  const { token } = req.query;

  if (!token || typeof token !== 'string') {
    throw new ValidationError('Verification token required');
  }

  // Find user with token
  const user = await db('users')
    .where({ verification_token: token })
    .where('verification_token_expires', '>', new Date())
    .whereNull('deleted_at')
    .first();

  if (!user) {
    throw new ValidationError('Invalid or expired verification token');
  }

  // Update user
  await db('users')
    .where({ id: user.id })
    .update({
      email_verified: true,
      verification_token: null,
      verification_token_expires: null,
      updated_at: new Date(),
    });

  // Log audit
  await createAuditLog(req, {
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
export async function requestPasswordReset(req: Request, res: Response) {
  const { email } = req.body;

  const user = await db('users')
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
  const resetToken = generateResetToken();
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  // Save token
  await db('users')
    .where({ id: user.id })
    .update({
      reset_password_token: resetToken,
      reset_password_expires: resetExpires,
      updated_at: new Date(),
    });

  // Send email
  const resetUrl = `${process.env.APP_URL}/reset-password?token=${resetToken}`;
  await emailService.sendPasswordResetEmail(
    email,
    user.first_name || 'there',
    resetUrl
  );

  // Log audit
  await createAuditLog(req, {
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
export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body;

  if (!token) {
    throw new ValidationError('Reset token required');
  }

  // Validate password
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    throw new ValidationError('Password does not meet requirements', passwordValidation.errors);
  }

  // Find user with token
  const user = await db('users')
    .where({ reset_password_token: token })
    .where('reset_password_expires', '>', new Date())
    .whereNull('deleted_at')
    .first();

  if (!user) {
    throw new ValidationError('Invalid or expired reset token');
  }

  // Hash new password
  const passwordHash = await hashPassword(password);

  // Update user
  await db('users')
    .where({ id: user.id })
    .update({
      password_hash: passwordHash,
      reset_password_token: null,
      reset_password_expires: null,
      updated_at: new Date(),
    });

  // Revoke all sessions
  await db('sessions')
    .where({ user_id: user.id })
    .update({ is_revoked: true, updated_at: new Date() });

  // Log audit
  await createAuditLog(req, {
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

/**
 * Update user profile
 */
export async function updateProfile(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  const { firstName, lastName, username, preferences } = req.body;

  const user = await db('users')
    .where({ id: userId })
    .whereNull('deleted_at')
    .first();

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Build update object
  const updateData: Record<string, any> = {
    updated_at: new Date(),
  };

  if (firstName !== undefined) updateData.first_name = firstName;
  if (lastName !== undefined) updateData.last_name = lastName;
  if (preferences !== undefined) updateData.preferences = preferences;

  // Check username uniqueness if being updated
  if (username !== undefined && username !== user.username) {
    const existingUser = await db('users')
      .where({ username })
      .whereNot({ id: userId })
      .whereNull('deleted_at')
      .first();

    if (existingUser) {
      throw new ConflictError('Username is already taken');
    }
    updateData.username = username;
  }

  // Update user
  const [updatedUser] = await db('users')
    .where({ id: userId })
    .update(updateData)
    .returning([
      'id',
      'email',
      'first_name',
      'last_name',
      'username',
      'profile_image',
      'email_verified',
      'preferences',
      'created_at',
    ]);

  // Log audit
  await createAuditLog(req, {
    userId,
    action: 'profile_updated',
    entityType: 'user',
    entityId: userId,
    oldValues: {
      firstName: user.first_name,
      lastName: user.last_name,
      username: user.username,
    },
    newValues: {
      firstName: updatedUser.first_name,
      lastName: updatedUser.last_name,
      username: updatedUser.username,
    },
  });

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        firstName: updatedUser.first_name,
        lastName: updatedUser.last_name,
        username: updatedUser.username,
        profileImage: updatedUser.profile_image,
        emailVerified: updatedUser.email_verified,
        preferences: updatedUser.preferences,
        createdAt: updatedUser.created_at,
      },
    },
  });
}

/**
 * Change password (for authenticated users)
 */
export async function changePassword(req: Request, res: Response) {
  const userId = (req as any).user?.userId;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ValidationError('Current password and new password are required');
  }

  const user = await db('users')
    .where({ id: userId })
    .whereNull('deleted_at')
    .first();

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Verify current password
  const isPasswordValid = await comparePassword(currentPassword, user.password_hash);
  if (!isPasswordValid) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // Validate new password strength
  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.valid) {
    throw new ValidationError('New password does not meet requirements', passwordValidation.errors);
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update password
  await db('users')
    .where({ id: userId })
    .update({
      password_hash: passwordHash,
      updated_at: new Date(),
    });

  // Revoke all other sessions (keep current session)
  const { refreshToken } = req.cookies;
  await db('sessions')
    .where({ user_id: userId })
    .whereNot({ refresh_token: refreshToken })
    .update({ is_revoked: true, updated_at: new Date() });

  // Log audit
  await createAuditLog(req, {
    userId,
    action: 'password_changed',
    entityType: 'user',
    entityId: userId,
  });

  res.json({
    success: true,
    message: 'Password changed successfully. Other sessions have been logged out.',
  });
}

/**
 * Resend email verification
 */
export async function resendVerificationEmail(req: Request, res: Response) {
  const { email } = req.body;

  if (!email || !validator.isEmail(email)) {
    throw new ValidationError('Valid email address is required');
  }

  const user = await db('users')
    .where({ email })
    .whereNull('deleted_at')
    .first();

  // Always return success to prevent email enumeration
  if (!user || user.email_verified) {
    res.json({
      success: true,
      message: 'If an unverified account exists with this email, a verification link has been sent.',
    });
    return;
  }

  // Generate new verification token
  const verificationToken = generateVerificationToken();
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Update user with new token
  await db('users')
    .where({ id: user.id })
    .update({
      verification_token: verificationToken,
      verification_token_expires: verificationExpires,
      updated_at: new Date(),
    });

  // Send verification email
  const verificationUrl = `${process.env.APP_URL}/verify-email?token=${verificationToken}`;
  await emailService.sendWelcomeEmail(
    email,
    user.first_name || 'there',
    verificationUrl
  );

  // Log audit
  await createAuditLog(req, {
    userId: user.id,
    action: 'verification_email_resent',
    entityType: 'user',
    entityId: user.id,
  });

  res.json({
    success: true,
    message: 'If an unverified account exists with this email, a verification link has been sent.',
  });
}
