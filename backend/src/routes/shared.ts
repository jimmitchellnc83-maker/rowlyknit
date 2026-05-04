import { Router } from 'express';
import { body, query } from 'express-validator';
import * as abbreviationController from '../controllers/abbreviationController';
import * as chartSharingController from '../controllers/chartSharingController';
import * as projectSharingController from '../controllers/projectSharingController';
import { sharedChartPasswordAttemptLimiter } from '../middleware/rateLimiter';
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
 * @route   GET /shared/project/:slug/photos/:photoId(/thumbnail)
 * @desc    Stream a project photo from a publicly-shared project. Slug
 *          acts as the capability; unpublishing kills the URL.
 * @access  Public (rate-limited via /shared/* limiter)
 */
router.get(
  '/project/:slug/photos/:photoId',
  asyncHandler(projectSharingController.viewSharedProjectPhoto)
);
router.get(
  '/project/:slug/photos/:photoId/thumbnail',
  asyncHandler(projectSharingController.viewSharedProjectPhoto)
);

/**
 * @route   GET /shared/chart/:token
 * @desc    View shared chart (public). Password-protected charts require
 *          an access token issued by POST /shared/chart/:token/access
 *          (sent as the `share_access_<token>` cookie or `x-share-access`
 *          header). The legacy `?password=` query param is no longer
 *          accepted — passwords in URLs leak through history, server
 *          logs, analytics, and Referer.
 * @access  Public
 */
router.get(
  '/chart/:token',
  asyncHandler(chartSharingController.viewSharedChart)
);

/**
 * @route   POST /shared/chart/:token/access
 * @desc    Verify a password for a protected shared chart and issue a
 *          short-lived (15-minute) HMAC-signed access token. Replaces
 *          the previous `?password=…` query-string flow.
 *
 *          Wears a STRICTER per-(ip, token) limiter than the rest of
 *          `/shared/*` (10 attempts / 15 min default) because this is a
 *          password-attempt surface — the general 60/min/IP would allow
 *          thousands of guesses per hour against a single share.
 * @access  Public
 */
router.post(
  '/chart/:token/access',
  sharedChartPasswordAttemptLimiter,
  [body('password').isString().isLength({ min: 1, max: 256 })],
  validate,
  asyncHandler(chartSharingController.verifySharedChartAccess)
);

/**
 * @route   GET /shared/chart/:token/download
 * @desc    Download shared chart (public). Password-protected charts
 *          require the access cookie/header from /access (see above).
 * @access  Public
 */
router.get(
  '/chart/:token/download',
  [query('format').optional({ values: 'null' }).isIn(['pdf', 'png', 'csv'])],
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
