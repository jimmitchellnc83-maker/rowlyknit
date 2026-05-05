import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import validator from 'validator';
import { redisClient } from '../config/redis';
import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

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
  const user = req.user as any;
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
      const userId = req.user?.userId || req.ip;
      logger.debug(`Rate limit check for ${userId}: tier=${tier}, limit=${limit}, window=${window}`);

      return limit;
    },
    message: (req: any) => {
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
      let userId = req.user?.userId;

      // If not available, try to extract from JWT token in Authorization header
      if (!userId) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          try {
            const token = authHeader.substring(7);
            // Quick decode of JWT payload (without verification, just for user ID)
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
            userId = payload.userId;
          } catch (error) {
            // If token parsing fails, userId remains undefined
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
      const userId = req.user?.userId || req.ip;

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
 * Login rate limiter — 5 requests per minute per IP. Successful logins are
 * not counted (skipSuccessfulRequests=true) so a knitter who logs in,
 * logs out, and logs back in a few times in a minute won't get throttled.
 *
 * Historically named `authLimiter`; `loginLimiter` is the canonical name
 * going forward and `authLimiter` is preserved as a thin re-export for any
 * external code still importing the old symbol.
 */
export const loginLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: ((...args: any[]) => redisClient.call(args[0], ...args.slice(1))) as any,
  }),
  windowMs: 60000, // 1 minute
  max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || process.env.AUTH_RATE_LIMIT_MAX || '5'),
  message: {
    success: false,
    message: 'Too many login attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `login:${req.ip || 'unknown'}`,
  skipSuccessfulRequests: true,
});

/**
 * Registration rate limiter — counts BOTH successful and failed requests
 * so a single IP cannot spin up unlimited accounts in a minute. The cap
 * is still generous enough that a household / family-of-four registering
 * at the same time won't trip it.
 *
 * Login can afford `skipSuccessfulRequests: true` (the only thing a
 * successful login proves is that the actor knows the password). Register
 * cannot — every successful POST creates a real row, so we have to count
 * the wins.
 */
export const registerLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: ((...args: any[]) => redisClient.call(args[0], ...args.slice(1))) as any,
  }),
  windowMs: 60000, // 1 minute
  max: parseInt(process.env.REGISTER_RATE_LIMIT_MAX || '5'),
  message: {
    success: false,
    message: 'Too many registration attempts, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `register:${req.ip || 'unknown'}`,
  // Default: count everything (skipSuccessfulRequests is false).
});

/**
 * Backwards-compatible alias. Old import sites that say `authLimiter` keep
 * working but receive the login-shaped behavior (successful requests do
 * not count). Prefer `loginLimiter` / `registerLimiter` in new code.
 */
export const authLimiter = loginLimiter;

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
    return req.user?.userId || req.ip || 'unknown';
  },
});

/**
 * Password reset rate limiter — composite throttle across two dimensions:
 *
 *   1) Per-email — 3 / hour. Stops a single account from being spammed
 *      with reset emails (whether by the user, a misbehaving form, or an
 *      attacker who knows the address).
 *   2) Per-IP — 20 / hour. Stops one origin from spraying many email
 *      addresses to map which ones exist or to mass-send reset emails.
 *
 * Either limit hitting first returns 429. Per-email alone wasn't enough:
 * an attacker could rotate the email field across 1000 addresses an hour
 * and stay under the per-email cap forever. Both gates run sequentially
 * (express middleware chain), so the first one to fire wins.
 *
 * Per-email key uses validator.normalizeEmail() (the same canonicalization
 * the express-validator chain runs in the route definition). Codex caught
 * a bypass on PR #382: a bare trim+lowercase let `Foo.Bar+spam@gmail.com`
 * and `foobar@gmail.com` land in different buckets even though they
 * resolve to the same Gmail account. We now share the canonical form so
 * provider-normalized variants share one bucket.
 */
export const normalizeResetEmail = (raw: string): string | null => {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // validator.normalizeEmail returns `false` for clearly-invalid input;
  // fall back to lowercased trim so the limiter still buckets bad input
  // (the validator chain after the limiter will still 400 it).
  const normalized = validator.normalizeEmail(trimmed);
  return normalized || trimmed.toLowerCase();
};

/**
 * Pre-normalization middleware: runs before the password-reset limiters
 * so both the limiter keyGenerator and the downstream express-validator
 * chain see one canonical email. Mutating `req.body.email` here is safe
 * because the validator's `normalizeEmail()` is idempotent on already-
 * normalized input.
 */
export const normalizePasswordResetEmail = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (req.body && typeof req.body.email === 'string') {
    const normalized = normalizeResetEmail(req.body.email);
    if (normalized) {
      req.body.email = normalized;
    }
  }
  next();
};

export const passwordResetIpLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: ((...args: any[]) => redisClient.call(args[0], ...args.slice(1))) as any,
  }),
  windowMs: 3600000, // 1 hour
  max: parseInt(process.env.PASSWORD_RESET_IP_RATE_LIMIT_MAX || '20'),
  message: {
    success: false,
    message: 'Too many password reset requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `pwreset-ip:${req.ip || 'unknown'}`,
});

export const passwordResetEmailLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: ((...args: any[]) => redisClient.call(args[0], ...args.slice(1))) as any,
  }),
  windowMs: 3600000, // 1 hour
  max: parseInt(process.env.PASSWORD_RESET_EMAIL_RATE_LIMIT_MAX || '3'),
  message: {
    success: false,
    message: 'Too many password reset requests, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  // The route mounts `normalizePasswordResetEmail` ahead of this limiter,
  // so by the time we read `req.body.email` it's already canonical
  // (provider-aware normalization, not just lowercase). When the
  // normalization yields nothing usable (missing/invalid), fall back to
  // an IP-scoped bucket so the limiter still applies and is distinct
  // from other IPs doing the same thing.
  keyGenerator: (req) => {
    const raw = req.body && typeof req.body.email === 'string' ? req.body.email : '';
    const canonical = raw ? normalizeResetEmail(raw) : null;
    return canonical
      ? `pwreset-email:${canonical}`
      : `pwreset-email:fallback-ip:${req.ip || 'unknown'}`;
  },
});

/**
 * Composite reset limiter: applies the IP gate first (fast-fail on
 * spraying) then the per-email gate (per-account spam). Mounted as a
 * single middleware on the route so the order is fixed and the route
 * doesn't have to know about both pieces.
 *
 * Backwards-compatible alias — old `passwordResetLimiter` callers keep
 * working but get the stronger composite check.
 */
export const passwordResetLimiter = [passwordResetIpLimiter, passwordResetEmailLimiter];

/**
 * Hourly API rate limiter based on user tier
 */
export const apiLimiterHourly = createDynamicLimiter('perHour');

/**
 * Daily API rate limiter based on user tier
 */
export const apiLimiterDaily = createDynamicLimiter('perDay');

/**
 * Public shared-content rate limiter — keyed by IP, applied to the
 * `/shared/*` routes which serve unauthenticated finished-object pages
 * and chart links. Generous enough that someone genuinely sharing a link
 * to a small group never hits it; tight enough to make scraping
 * impractical. 60/min per IP.
 */
export const publicSharedLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: ((...args: any[]) => redisClient.call(args[0], ...args.slice(1))) as any,
  }),
  windowMs: 60000,
  max: parseInt(process.env.PUBLIC_SHARED_RATE_LIMIT_MAX || '60'),
  message: {
    success: false,
    message: 'Too many requests for shared content, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `shared:${req.ip || 'unknown'}`,
});

/**
 * Stricter limiter for POST /shared/chart/:token/access — the password-
 * verification endpoint. Without this, the only protection on a protected
 * share is the 60/min/IP `publicSharedLimiter`, which allows ~3.6k
 * password attempts/hour per IP — fine for browsing, far too lax for a
 * brute-force gate.
 *
 * Keyed by `${ip}:${token}` so that:
 *   - an attacker hammering one share's password can be throttled without
 *     locking another recipient on the same NAT out of a different share;
 *   - rotating tokens does NOT reset the limit (we'd key by token alone
 *     for that, but then a single attacker IP can pivot across many
 *     tokens — IP must be in the key).
 *
 * Default: 10 attempts / 15 minutes per (ip, token). Successful unlocks
 * still count — that's intentional. A legitimate recipient typing the
 * password wrong a few times then succeeding is well under 10.
 */
export const sharedChartPasswordAttemptLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: ((...args: any[]) => redisClient.call(args[0], ...args.slice(1))) as any,
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.SHARE_PASSWORD_RATE_LIMIT_MAX || '10'),
  message: {
    success: false,
    message: 'Too many password attempts for this share, please try again later',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // `req.params.token` is set by the route param. Fall back to the
    // raw URL fragment if for some reason params aren't populated yet
    // (defensive — should never happen in practice).
    const token =
      (req.params && (req.params as Record<string, string>).token) ||
      req.path.split('/').slice(-2, -1)[0] ||
      'unknown';
    return `share-pw:${req.ip || 'unknown'}:${token}`;
  },
});

/**
 * Get current rate limit status for a user
 * Can be used in an API endpoint to show users their current usage
 */
export async function getRateLimitStatus(req: Request) {
  const tier = getUserTier(req);
  const userId = req.user?.userId;
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
