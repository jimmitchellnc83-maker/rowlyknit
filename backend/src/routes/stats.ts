import { Router } from 'express';
import { query } from 'express-validator';
import * as statsController from '../controllers/statsController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/stats
 * @desc    Get user knitting statistics
 * @access  Private
 * @query   period - 'today' | 'week' | 'month' | 'all'
 */
router.get(
  '/',
  [
    query('period')
      .optional()
      .isIn(['today', 'week', 'month', 'all'])
      .withMessage('Period must be one of: today, week, month, all')
  ],
  validate,
  asyncHandler(statsController.getStats)
);

/**
 * @route   GET /api/stats/summary
 * @desc    Get quick stats summary for dashboard widgets
 * @access  Private
 */
router.get(
  '/summary',
  asyncHandler(statsController.getStatsSummary)
);

export default router;
