import { Router } from 'express';
import { body } from 'express-validator';
import * as usageEventsController from '../controllers/usageEventsController';
import { authenticate } from '../middleware/auth';
import { requireOwner } from '../middleware/requireOwner';
import { validate } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

router.use(authenticate);

/**
 * @route   POST /api/usage-events
 * @desc    Log one usage event for the current user
 */
router.post(
  '/',
  [
    body('eventName').isString().isLength({ min: 2, max: 63 }),
    body('entityId').optional({ values: 'null' }).isUUID(),
    body('metadata').optional().isObject(),
  ],
  validate,
  asyncHandler(usageEventsController.createUsageEvent),
);

/**
 * @route   GET /api/usage-events/summary
 * @desc    Global event + unique-user counts per event_name. Owner-only
 *          — this rolls up across the whole user base, so we can't
 *          expose it to every authenticated user.
 */
router.get(
  '/summary',
  requireOwner,
  asyncHandler(usageEventsController.getUsageSummary),
);

export default router;
