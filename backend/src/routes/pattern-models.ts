/**
 * Routes for the canonical Pattern model — PR 5 of the Designer
 * rebuild. Mounted at `/api/pattern-models` from app.ts.
 *
 * All routes require authentication. The wildcard `/:id` paths are
 * declared LAST so the listing endpoint takes priority.
 */

import { Router } from 'express';
import { body, query } from 'express-validator';
import * as patternModelsController from '../controllers/patternModelsController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

router.use(authenticate);

/**
 * @route   GET /api/pattern-models
 * @desc    List the user's canonical patterns. Soft-deleted hidden by
 *          default — pass ?includeDeleted=true to see them.
 * @access  Private
 */
router.get(
  '/',
  [
    query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 200 }),
    query('offset').optional({ values: 'falsy' }).isInt({ min: 0 }),
    query('includeDeleted').optional({ values: 'falsy' }).isBoolean(),
  ],
  validate,
  asyncHandler(patternModelsController.list),
);

/**
 * @route   POST /api/pattern-models
 * @desc    Create a new canonical pattern.
 * @access  Private
 */
router.post(
  '/',
  [
    body('name').isString().trim().isLength({ min: 1, max: 255 }),
    body('craft').isIn(['knit', 'crochet']),
    body('technique').optional({ values: 'falsy' }).isIn([
      'standard', 'lace', 'cables', 'colorwork', 'tapestry', 'filet', 'tunisian',
    ]),
    body('gaugeProfile').optional({ values: 'null' }).isObject(),
    body('sizeSet').optional({ values: 'null' }).isObject(),
    body('sections').optional({ values: 'null' }).isArray(),
    body('legend').optional({ values: 'null' }).isObject(),
    body('materials').optional({ values: 'null' }).isArray(),
    body('progressState').optional({ values: 'null' }).isObject(),
    body('notes').optional({ values: 'null' }).isString().isLength({ max: 10000 }),
    body('sourcePatternId').optional({ values: 'null' }).isUUID(),
    body('sourceProjectId').optional({ values: 'null' }).isUUID(),
  ],
  validate,
  asyncHandler(patternModelsController.create),
);

/**
 * @route   GET /api/pattern-models/:id
 * @desc    Fetch a single canonical pattern by id.
 * @access  Private (owner only)
 */
router.get(
  '/:id',
  validateUUID('id'),
  asyncHandler(patternModelsController.getOne),
);

/**
 * @route   PUT /api/pattern-models/:id
 * @desc    Patch a canonical pattern. All fields optional.
 * @access  Private (owner only)
 */
router.put(
  '/:id',
  [
    validateUUID('id'),
    body('name').optional({ values: 'falsy' }).isString().trim().isLength({ min: 1, max: 255 }),
    body('craft').optional({ values: 'falsy' }).isIn(['knit', 'crochet']),
    body('technique').optional({ values: 'falsy' }).isIn([
      'standard', 'lace', 'cables', 'colorwork', 'tapestry', 'filet', 'tunisian',
    ]),
    body('gaugeProfile').optional({ values: 'null' }).isObject(),
    body('sizeSet').optional({ values: 'null' }).isObject(),
    body('sections').optional({ values: 'null' }).isArray(),
    body('legend').optional({ values: 'null' }).isObject(),
    body('materials').optional({ values: 'null' }).isArray(),
    body('progressState').optional({ values: 'null' }).isObject(),
    body('notes').optional({ values: 'null' }).isString().isLength({ max: 10000 }),
  ],
  validate,
  asyncHandler(patternModelsController.update),
);

/**
 * @route   DELETE /api/pattern-models/:id
 * @desc    Soft-delete a canonical pattern.
 * @access  Private (owner only)
 */
router.delete(
  '/:id',
  validateUUID('id'),
  asyncHandler(patternModelsController.remove),
);

export default router;
