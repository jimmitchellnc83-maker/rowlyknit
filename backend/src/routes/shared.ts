import { Router } from 'express';
import { query } from 'express-validator';
import * as abbreviationController from '../controllers/abbreviationController';
import * as chartSharingController from '../controllers/chartSharingController';
import * as projectSharingController from '../controllers/projectSharingController';
import { validate } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

const VALID_CRAFTS = ['knit', 'crochet', 'tunisian', 'loom-knit'];

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

/**
 * Public CYC abbreviation glossary. Same controllers as the auth routes —
 * `req.user` is undefined here so only system rows are returned. Mounted
 * under `/shared/*` so the existing 60-req/min/IP limiter applies.
 */
router.get(
  '/glossary',
  [
    query('craft').optional({ values: 'falsy' }).isIn(VALID_CRAFTS),
    query('category').optional({ values: 'falsy' }).isString().isLength({ max: 32 }),
    query('search').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
    query('q').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
  ],
  validate,
  asyncHandler(abbreviationController.list)
);

router.get(
  '/glossary/lookup',
  [
    query('abbreviation').isString().notEmpty().isLength({ max: 32 }),
    query('craft').isIn(VALID_CRAFTS),
  ],
  validate,
  asyncHandler(abbreviationController.lookup)
);

router.get(
  '/glossary/categories',
  [query('craft').optional({ values: 'falsy' }).isIn(VALID_CRAFTS)],
  validate,
  asyncHandler(abbreviationController.categories)
);

export default router;
