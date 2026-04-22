import { Router } from 'express';
import { body } from 'express-validator';
import * as yarnController from '../controllers/yarnController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID, validatePagination, validateSearch } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

router.use(authenticate);

router.get(
  '/',
  validatePagination,
  validateSearch,
  asyncHandler(yarnController.getYarn)
);

router.get('/stats', asyncHandler(yarnController.getYarnStats));

/**
 * @route   POST /api/yarn/substitutions
 * @desc    Score the user's stash against a standalone yarn spec
 *          (weight / fibers / yardage / skein count). Returns
 *          traffic-light-ranked candidates using the same matcher as
 *          the pattern feasibility check.
 * @access  Private
 */
router.post(
  '/substitutions',
  [
    body('weightName').optional({ values: 'null' }).isString().isLength({ max: 50 }),
    body('fiberHints').optional({ values: 'null' }).isArray(),
    body('fiberHints.*').optional().isString().isLength({ max: 30 }),
    body('yardage').optional({ values: 'falsy' }).isNumeric(),
    body('skeinCount').optional({ values: 'falsy' }).isNumeric(),
  ],
  validate,
  asyncHandler(yarnController.getYarnSubstitutions)
);

router.get(
  '/:id',
  validateUUID('id'),
  asyncHandler(yarnController.getYarnById)
);

router.get(
  '/:id/projects',
  validateUUID('id'),
  asyncHandler(yarnController.getProjectsUsingYarn)
);

router.post(
  '/',
  [
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('brand').optional().trim(),
    body('weight').optional().trim(),
  ],
  validate,
  asyncHandler(yarnController.createYarn)
);

router.put(
  '/:id',
  [
    validateUUID('id'),
    body('brand').optional({ values: 'null' }).trim().isLength({ max: 255 }),
    body('line').optional({ values: 'null' }).trim().isLength({ max: 255 }),
    body('name').optional({ values: 'null' }).trim().isLength({ max: 255 }),
    body('color').optional({ values: 'null' }).trim().isLength({ max: 100 }),
    body('colorCode').optional({ values: 'null' }).trim().isLength({ max: 50 }),
    body('weight').optional({ values: 'null' }).trim().isLength({ max: 50 }),
    body('fiberContent').optional({ values: 'null' }).isString(),
    body('yardsTotal').optional({ values: 'falsy' }).isNumeric(),
    body('gramsTotal').optional({ values: 'falsy' }).isNumeric(),
    body('skeinsTotal').optional({ values: 'falsy' }).isNumeric(),
    body('pricePerSkein').optional({ values: 'falsy' }).isNumeric(),
    body('purchaseDate').optional({ values: 'falsy' }).isISO8601(),
    body('purchaseLocation').optional({ values: 'null' }).isString(),
    body('dyeLot').optional({ values: 'null' }).isString(),
    body('notes').optional({ values: 'null' }).isString(),
    body('tags').optional({ values: 'null' }),
    body('lowStockThreshold').optional({ values: 'falsy' }).isNumeric(),
    body('lowStockAlert').optional().isBoolean(),
    body('gauge').optional({ values: 'null' }).isString(),
    body('needleSizes').optional({ values: 'null' }).isString(),
    body('machineWashable').optional().isBoolean(),
    body('discontinued').optional().isBoolean(),
    body('ravelryRating').optional({ values: 'falsy' }).isNumeric(),
    body('description').optional({ values: 'null' }).isString(),
    body('isFavorite').optional().isBoolean(),
  ],
  validate,
  asyncHandler(yarnController.updateYarn)
);

router.delete(
  '/:id',
  validateUUID('id'),
  asyncHandler(yarnController.deleteYarn)
);

export default router;
