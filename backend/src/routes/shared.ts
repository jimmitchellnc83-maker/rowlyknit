import { Router } from 'express';
import { query } from 'express-validator';
import * as chartSharingController from '../controllers/chartSharingController';
import { validate } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

/**
 * Public Shared Content Routes
 * These routes do NOT require authentication
 */

/**
 * @route   GET /shared/chart/:token
 * @desc    View shared chart (public)
 * @access  Public
 */
router.get(
  '/chart/:token',
  [query('password').optional().isString()],
  validate,
  asyncHandler(chartSharingController.viewSharedChart)
);

/**
 * @route   GET /shared/chart/:token/download
 * @desc    Download shared chart (public)
 * @access  Public
 */
router.get(
  '/chart/:token/download',
  [
    query('format').optional().isIn(['pdf', 'png', 'csv']),
    query('password').optional().isString(),
  ],
  validate,
  asyncHandler(chartSharingController.downloadSharedChart)
);

export default router;
