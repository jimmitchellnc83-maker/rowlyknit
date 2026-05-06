import { Router } from 'express';
import * as adminBusinessDashboardController from '../controllers/adminBusinessDashboardController';
import { authenticate } from '../middleware/auth';
import { requireOwner } from '../middleware/requireOwner';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

router.use(authenticate);

/**
 * @route   GET /api/admin/business-dashboard
 * @desc    Owner-only operational founder dashboard. Aggregates launch
 *          readiness, revenue, user growth, funnel, public-tools
 *          performance, product usage, content/SEO posture, and an
 *          owner-action checklist.
 * @access  Owner-only (OWNER_EMAIL allowlist)
 */
router.get(
  '/business-dashboard',
  requireOwner,
  asyncHandler(adminBusinessDashboardController.getBusinessDashboard),
);

export default router;
