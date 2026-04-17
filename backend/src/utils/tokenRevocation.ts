import { redisClient } from '../config/redis';
import logger from '../config/logger';

const JTI_DENY_PREFIX = 'jwt:revoked:jti:';
const USER_EPOCH_PREFIX = 'jwt:revoked:user:';

// Password reset/change epoch keys persist up to the longest refresh-token lifetime.
// 30 days covers the "remember me" case; regular sessions expire sooner.
const USER_EPOCH_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Add an access token's jti to the Redis deny-list with TTL matching the token's exp.
 * Fails open on Redis errors to preserve availability; errors are logged.
 */
export async function revokeAccessTokenJti(jti: string, expEpochSecs: number): Promise<void> {
  const nowSecs = Math.floor(Date.now() / 1000);
  const ttl = Math.max(1, expEpochSecs - nowSecs);
  try {
    await redisClient.set(`${JTI_DENY_PREFIX}${jti}`, '1', 'EX', ttl);
  } catch (err) {
    logger.error('Failed to revoke jti in Redis deny-list', {
      error: err instanceof Error ? err.message : String(err),
      jti,
    });
  }
}

/**
 * Check whether a jti is on the Redis deny-list.
 * Fails open on Redis errors (returns false) to avoid logging all users out during a Redis outage.
 */
export async function isJtiRevoked(jti: string): Promise<boolean> {
  try {
    const result = await redisClient.exists(`${JTI_DENY_PREFIX}${jti}`);
    return result === 1;
  } catch (err) {
    logger.error('Redis jti deny-list lookup failed; allowing token', {
      error: err instanceof Error ? err.message : String(err),
      jti,
    });
    return false;
  }
}

/**
 * Mark all tokens issued before `epochSecs` for a user as invalid.
 * Used on password change and password reset to invalidate any outstanding access tokens.
 * Defaults to "now".
 */
export async function revokeAllUserTokensBefore(userId: string, epochSecs?: number): Promise<void> {
  const cutoff = epochSecs ?? Math.floor(Date.now() / 1000);
  try {
    await redisClient.set(
      `${USER_EPOCH_PREFIX}${userId}`,
      String(cutoff),
      'EX',
      USER_EPOCH_TTL_SECONDS
    );
  } catch (err) {
    logger.error('Failed to set user revoked-before epoch in Redis', {
      error: err instanceof Error ? err.message : String(err),
      userId,
    });
  }
}

/**
 * Return the earliest `iat` a token for this user must have to be considered valid,
 * or null if no cutoff is set. Fails open on Redis errors.
 */
export async function getUserRevokedBefore(userId: string): Promise<number | null> {
  try {
    const value = await redisClient.get(`${USER_EPOCH_PREFIX}${userId}`);
    if (!value) return null;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch (err) {
    logger.error('Redis user revoked-before lookup failed; allowing token', {
      error: err instanceof Error ? err.message : String(err),
      userId,
    });
    return null;
  }
}
