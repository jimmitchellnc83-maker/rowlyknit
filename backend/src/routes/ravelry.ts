import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../config/redis';
import { authenticate } from '../middleware/auth';
import { asyncHandler } from '../utils/errorHandler';
import * as ravelryController from '../controllers/ravelryController';
import * as ravelryOAuthController from '../controllers/ravelryOAuthController';

const router = Router();

// All Ravelry routes require authentication
router.use(authenticate);

// Ravelry-specific rate limiter: 30 requests per minute per user
const ravelryLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: ((...args: any[]) => redisClient.call(args[0], ...args.slice(1))) as any,
  }),
  windowMs: 60000, // 1 minute
  max: 30,
  message: {
    success: false,
    message: 'Too many Ravelry API requests. Please wait a moment and try again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return `ravelry:${req.user?.userId || req.ip}`;
  },
});

router.use(ravelryLimiter);

// OAuth routes
router.get('/oauth/authorize', asyncHandler(ravelryOAuthController.getAuthorizationUrl));
router.post('/oauth/callback', asyncHandler(ravelryOAuthController.handleCallback));
router.get('/oauth/status', asyncHandler(ravelryOAuthController.getConnectionStatus));
router.delete('/oauth/disconnect', asyncHandler(ravelryOAuthController.disconnect));

// Yarn endpoints
router.get('/yarns/search', asyncHandler(ravelryController.searchYarns));
router.get('/yarns/:id', asyncHandler(ravelryController.getYarn));

// Pattern endpoints
router.get('/patterns/search', asyncHandler(ravelryController.searchPatterns));
router.get('/patterns/:id', asyncHandler(ravelryController.getPattern));

// Reference data endpoints (Basic Auth)
router.get('/yarn-weights', asyncHandler(ravelryController.getYarnWeights));
router.get('/color-families', asyncHandler(ravelryController.getColorFamilies));

export default router;
