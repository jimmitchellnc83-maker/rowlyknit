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
 * Mount order matters: `app.ts` mounts this router on
 * `/shared/analytics` BEFORE the broader `app.use('/shared/',
 * publicSharedLimiter)`, so the analytics endpoint does NOT inherit
 * the 60/min `publicSharedLimiter`. Instead it carries its own
 * dedicated `publicAnalyticsLimiter` (120/min/IP, applied at the
 * router level below) — public tool views are higher-volume than
 * chart/project shares, and a single 60/min ceiling shared with the
 * other `/shared/*` routes would blackout legit telemetry from a hot
 * page. The mount-order pin lives in
 * `backend/src/__tests__/sharedAnalyticsMountOrder.test.ts`. The
 * `authenticate` middleware that gates `/api/*` is also bypassed by
 * design — public surfaces fire telemetry pre-login.
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
