import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../utils/jwt';
import { UnauthorizedError } from '../utils/errorHandler';
import db from '../config/database';
import { isJtiRevoked, getUserRevokedBefore } from '../utils/tokenRevocation';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Authentication middleware - verifies JWT token
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Get token from Authorization header or cookie
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (!token) {
      throw new UnauthorizedError('No authentication token provided');
    }

    // Verify token
    const payload = verifyAccessToken(token);

    // Revocation checks: jti deny-list (per-token) + user-level revoked-before epoch
    // (set on password change/reset to invalidate all outstanding access tokens).
    if (payload.jti && (await isJtiRevoked(payload.jti))) {
      throw new UnauthorizedError('Token has been revoked');
    }

    const revokedBefore = await getUserRevokedBefore(payload.userId);
    if (revokedBefore && payload.iat && payload.iat < revokedBefore) {
      throw new UnauthorizedError('Token has been revoked');
    }

    // Check if user exists and is active
    const user = await db('users')
      .where({ id: payload.userId, is_active: true })
      .whereNull('deleted_at')
      .first();

    if (!user) {
      throw new UnauthorizedError('User not found or inactive');
    }

    // Attach user to request
    req.user = payload;

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError('Invalid authentication token'));
    }
  }
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuthenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      const payload = verifyAccessToken(token);

      if (payload.jti && (await isJtiRevoked(payload.jti))) {
        next();
        return;
      }

      const revokedBefore = await getUserRevokedBefore(payload.userId);
      if (revokedBefore && payload.iat && payload.iat < revokedBefore) {
        next();
        return;
      }

      const user = await db('users')
        .where({ id: payload.userId, is_active: true })
        .whereNull('deleted_at')
        .first();

      if (user) {
        req.user = payload;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
}
