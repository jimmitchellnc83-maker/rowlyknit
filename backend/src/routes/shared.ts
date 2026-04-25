import { Router } from 'express';
import { query } from 'express-validator';
import * as chartSharingController from '../controllers/chartSharingController';
import * as projectSharingController from '../controllers/projectSharingController';
import { validate } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

/**
 * Public Shared Content Routes
 * These routes do NOT require authentication
 */

/**
 * @route   GET /shared/project/:slug
 * @desc    View a publicly-shared project (FO/finished-object page)
 * @access  Public
 */
router.get(
  '/project/:slug',
  asyncHandler(projectSharingController.viewSharedProject)
);

/**
 * @route   GET /shared/chart/:token
 * @desc    View shared chart (public)
 * @access  Public
 */
router.get(
  '/chart/:token',
  [query('password').optional({ values: 'null' }).isString()],
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
    query('format').optional({ values: 'null' }).isIn(['pdf', 'png', 'csv']),
    query('password').optional({ values: 'null' }).isString(),
  ],
  validate,
  asyncHandler(chartSharingController.downloadSharedChart)
);

export default router;
