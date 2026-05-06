import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../config/redis';
import { authenticate } from '../middleware/auth';
import { requireEntitlement } from '../middleware/requireEntitlement';
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
router.get('/yarns/:id/packs', asyncHandler(ravelryController.getYarnPacks));

// Pattern endpoints
router.get('/patterns/search', asyncHandler(ravelryController.searchPatterns));
router.get('/patterns/:id', asyncHandler(ravelryController.getPattern));

// User's favorited patterns on Ravelry
router.get('/favorites', asyncHandler(ravelryController.getFavorites));

// Bulk imports — each call inserts up to a page-worth of durable rows
// (yarn / projects / wishlist yarn / bookmarks). Gate before the
// service runs so an unentitled user can't trigger the outbound
// Ravelry fetch + DB writes that follow.
//
// Read endpoints (search, single-yarn fetch, oauth status) stay
// open because they don't write durable workspace rows.
router.post('/stash/import', requireEntitlement, asyncHandler(ravelryController.importStashPage));
router.post('/projects/import', requireEntitlement, asyncHandler(ravelryController.importProjectsPage));
router.post('/favorites/yarns/import', requireEntitlement, asyncHandler(ravelryController.importFavoriteYarnsPage));
router.post('/queue/import', requireEntitlement, asyncHandler(ravelryController.importQueuePage));
router.post('/library/import', requireEntitlement, asyncHandler(ravelryController.importLibraryPage));
router.get('/bookmarks', asyncHandler(ravelryController.listBookmarks));

// Reference data endpoints (Basic Auth)
router.get('/yarn-weights', asyncHandler(ravelryController.getYarnWeights));
router.get('/color-families', asyncHandler(ravelryController.getColorFamilies));

export default router;
