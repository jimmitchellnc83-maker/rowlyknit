import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Helper function to get required environment variable or fail
function getRequiredEnv(key: string): string {
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

export interface TokenPayload {
  userId: string;
  email: string;
  jti?: string; // JWT ID for token revocation
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  jti?: string;
}

/**
 * Generate access token
 */
export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(
    { ...payload, jti: uuidv4() },
    JWT_SECRET,
    { algorithm: 'HS256', expiresIn: JWT_EXPIRY }
  );
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(
    { ...payload, jti: uuidv4() },
    JWT_REFRESH_SECRET,
    { algorithm: 'HS256', expiresIn: JWT_REFRESH_EXPIRY }
  );
}

/**
 * Verify access token
 */
export function verifyAccessToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

/**
 * Verify refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, { algorithms: ['HS256'] }) as RefreshTokenPayload;
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): any {
  return jwt.decode(token);
}

/**
 * Generate email verification token
 */
export function generateVerificationToken(): string {
  return uuidv4() + uuidv4(); // Extra long token for email verification
}

/**
 * Generate password reset token
 */
export function generateResetToken(): string {
  return uuidv4() + uuidv4(); // Extra long token for password reset
}
