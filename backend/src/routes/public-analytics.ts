import { Router } from 'express';
import { body } from 'express-validator';
import * as publicAnalyticsController from '../controllers/publicAnalyticsController';
import { publicAnalyticsLimiter } from '../middleware/rateLimiter';
import { validate } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

/**
 * @route   POST /shared/analytics/event
 * @desc    Record one first-party usage event from the public surface.
 *          Anonymous (no auth required); if a valid Bearer token is
 *          attached the controller records the user_id, otherwise the
 *          row is anonymous (user_id NULL).
 *
 * Mounted under `/shared/*` so it inherits the public-shared rate
 * limit AND skips the `authenticate` middleware that gates every
 * `/api/*` route. The dedicated `publicAnalyticsLimiter` adds a
 * second-tier per-IP cap on top of `publicSharedLimiter` because this
 * route is much higher-volume than chart/project shares.
 */
router.post(
  '/event',
  publicAnalyticsLimiter,
  [
    body('eventName').isString().isLength({ min: 2, max: 63 }),
    body('metadata').optional().isObject(),
    body('entityId').optional({ values: 'null' }).isString().isLength({ max: 64 }),
  ],
  validate,
  asyncHandler(publicAnalyticsController.recordPublicEvent),
);

export default router;
