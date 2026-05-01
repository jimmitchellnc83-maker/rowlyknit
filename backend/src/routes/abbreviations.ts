import { Router } from 'express';
import { query } from 'express-validator';
import * as abbreviationController from '../controllers/abbreviationController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

router.use(authenticate);

const VALID_CRAFTS = ['knit', 'crochet', 'tunisian', 'loom-knit'];

/**
 * @route   GET /api/abbreviations
 * @desc    List abbreviations, optionally filtered by craft / category /
 *          search. Returns system rows + the user's custom rows.
 * @access  Private
 */
router.get(
  '/',
  [
    query('craft').optional({ values: 'falsy' }).isIn(VALID_CRAFTS),
    query('category').optional({ values: 'falsy' }).isString().isLength({ max: 32 }),
    query('search').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
    query('q').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
  ],
  validate,
  asyncHandler(abbreviationController.list)
);

/**
 * @route   GET /api/abbreviations/lookup?abbreviation=k2tog&craft=knit
 * @desc    Exact case-sensitive lookup of a single system abbreviation.
 * @access  Private
 */
router.get(
  '/lookup',
  [
    query('abbreviation').isString().notEmpty().isLength({ max: 32 }),
    query('craft').isIn(VALID_CRAFTS),
  ],
  validate,
  asyncHandler(abbreviationController.lookup)
);

/**
 * @route   GET /api/abbreviations/categories?craft=knit
 * @desc    Category counts for filter chips.
 * @access  Private
 */
router.get(
  '/categories',
  [query('craft').optional({ values: 'falsy' }).isIn(VALID_CRAFTS)],
  validate,
  asyncHandler(abbreviationController.categories)
);

export default router;
