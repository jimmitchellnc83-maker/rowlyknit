import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../config/redis';
import { Request } from 'express';
import logger from '../config/logger';
import { verifyAccessToken } from '../utils/jwt';

/**
 * User tier definitions for rate limiting
 */
enum UserTier {
  FREE = 'free',
  PREMIUM = 'premium',
  ADMIN = 'admin',
}

/**
 * Rate limit configurations by user tier
 * Note: Limits are generous to accommodate normal usage patterns
 * Dashboard makes ~6 API calls on load, so limits account for this
 */
const TIER_LIMITS = {
  [UserTier.FREE]: {
    perMinute: 300,  // Increased from 60 to handle dashboard loads and normal usage
    perHour: 5000,   // Increased from 1000
    perDay: 50000,   // Increased from 10000
  },
  [UserTier.PREMIUM]: {
    perMinute: 600,  // Increased from 120
    perHour: 15000,  // Increased from 5000
    perDay: 150000,  // Increased from 50000
  },
  [UserTier.ADMIN]: {
    perMinute: 1000, // Increased from 300
    perHour: 30000,  // Increased from 15000
    perDay: 300000,  // Increased from 100000
  },
};

/**
 * Get user tier from request (can be extended to check database)
 */
function getUserTier(req: Request): UserTier {
  const user = (req as any).user;
  if (!user) return UserTier.FREE;

  // Check if user is admin (can be extended with database lookup)
  if (user.role === 'admin') return UserTier.ADMIN;

  // Check if user has premium subscription (can be extended with database lookup)
  if (user.isPremium) return UserTier.PREMIUM;

  return UserTier.FREE;
}

/**
 * Create dynamic rate limiter based on user tier
 */
function createDynamicLimiter(window: 'perMinute' | 'perHour' | 'perDay') {
  const windowConfig = {
    perMinute: 60000, // 1 minute
    perHour: 3600000, // 1 hour
    perDay: 86400000, // 24 hours
  };

  return rateLimit({
    store: new RedisStore({
      sendCommand: ((...args: any[]) => redisClient.call(args[0], ...args.slice(1))) as any,
    }),
    windowMs: windowConfig[window],
    max: (req) => {
      const tier = getUserTier(req);
      const limit = TIER_LIMITS[tier][window];

      // Log when user approaches limit
      const userId = (req as any).user?.userId || req.ip;
      logger.debug(`Rate limit check for ${userId}: tier=${tier}, limit=${limit}, window=${window}`);

      return limit;
    },
    message: (req) => {
      const tier = getUserTier(req);
      const limit = TIER_LIMITS[tier][window];

      return {
        success: false,
        message: `Rate limit exceeded. Your tier allows ${limit} requests per ${window.replace('per', '').toLowerCase()}.`,
        tier,
        limit,
        window,
      };
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      // Try to get user ID from req.user (if auth middleware already ran)
      let userId = (req as any).user?.userId;

      // If not available, try to extract from JWT token in Authorization header
      if (!userId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          try {
            const token = authHeader.substring(7);
            // Verify JWT and extract userId securely
            const payload = verifyAccessToken(token);
            userId = payload.userId;
          } catch (error) {
            // If token verification fails, fall back to IP-based rate limiting
            // This is expected for expired/invalid tokens
          }
        }
      }

      const tier = getUserTier(req);
      // Include tier in key to separate limits by tier
      // Use userId if available, otherwise fall back to IP
      return userId ? `user:${userId}:${tier}:${window}` : `ip:${req.ip}:${window}`;
    },
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health' || req.path === '/api/health';
    },
    handler: (req, res) => {
      const tier = getUserTier(req);
      const userId = (req as any).user?.userId || req.ip;

      logger.warn('Rate limit exceeded', {
        userId,
        tier,
        window,
        ip: req.ip,
        path: req.path,
        method: req.method,
      });

      res.status(429).json({
        success: false,
        message: `Too many requests. Your ${tier} tier allows ${TIER_LIMITS[tier][window]} requests per ${window.replace('per', '').toLowerCase()}.`,
        tier,
        limit: TIER_LIMITS[tier][window],
        retryAfter: res.getHeader('Retry-After'),
      });
    },
  });
}

/**
 * General API rate limiter - Per minute limit based on user tier
 */
export const apiLimiter = createDynamicLimiter('perMinute');

/**
 * Strict rate limiter for authentication endpoints - 5 requests per minute
 */
export const authLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: ((...args: any[]) => redisClient.call(args[0], ...args.slice(1))) as any,
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
export const uploadLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: ((...args: any[]) => redisClient.call(args[0], ...args.slice(1))) as any,
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
    return (req as any).user?.userId || req.ip || 'unknown';
  },
});

/**
 * Password reset rate limiter - 3 requests per hour
 */
export const passwordResetLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: ((...args: any[]) => redisClient.call(args[0], ...args.slice(1))) as any,
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

/**
 * Hourly API rate limiter based on user tier
 */
export const apiLimiterHourly = createDynamicLimiter('perHour');

/**
 * Daily API rate limiter based on user tier
 */
export const apiLimiterDaily = createDynamicLimiter('perDay');

/**
 * Get current rate limit status for a user
 * Can be used in an API endpoint to show users their current usage
 */
export async function getRateLimitStatus(req: Request) {
  const tier = getUserTier(req);
  const userId = (req as any).user?.userId;
  const limits = TIER_LIMITS[tier];

  if (!userId) {
    return {
      tier,
      limits,
      message: 'Authentication required to see detailed rate limit status',
    };
  }

  try {
    // Get current usage from Redis for each window
    const windows = ['perMinute', 'perHour', 'perDay'] as const;
    const usage: Record<string, any> = {};

    for (const window of windows) {
      const key = `user:${userId}:${tier}:${window}`;
      const count = await redisClient.get(key);
      const ttl = await redisClient.ttl(key);

      usage[window] = {
        used: parseInt(count || '0'),
        limit: limits[window],
        remaining: limits[window] - parseInt(count || '0'),
        resetsIn: ttl > 0 ? ttl : null,
      };
    }

    return {
      tier,
      userId,
      limits,
      usage,
    };
  } catch (error) {
    logger.error('Error getting rate limit status', { error, userId });
    return {
      tier,
      limits,
      error: 'Failed to retrieve rate limit status',
    };
  }
}

/**
 * Export user tier enum and limits for use in other modules
 */
export { UserTier, TIER_LIMITS };
