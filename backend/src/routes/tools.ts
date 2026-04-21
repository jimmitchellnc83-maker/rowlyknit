import { Router } from 'express';
import { body } from 'express-validator';
import * as toolsController from '../controllers/toolsController';
import * as taxonomyController from '../controllers/toolTaxonomyController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID, validatePagination, validateSearch } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

router.use(authenticate);

// Taxonomy autocomplete — must be before /:id to avoid conflict
router.get('/taxonomy/search', asyncHandler(taxonomyController.searchToolTaxonomy));
router.get('/taxonomy/categories', asyncHandler(taxonomyController.getCategories));
router.post('/taxonomy/recent', asyncHandler(taxonomyController.recordRecentSearch));

router.get(
  '/',
  validatePagination,
  validateSearch,
  asyncHandler(toolsController.getTools)
);

router.get('/stats', asyncHandler(toolsController.getToolStats));

router.get(
  '/:id',
  validateUUID('id'),
  asyncHandler(toolsController.getTool)
);

router.post(
  '/',
  [
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('type').trim().notEmpty(),
  ],
  validate,
  asyncHandler(toolsController.createTool)
);

router.put(
  '/:id',
  [
    validateUUID('id'),
    body('name').optional().trim().isLength({ max: 255 }),
    body('type').optional({ values: 'null' }).trim().isLength({ max: 100 }),
    body('category').optional({ values: 'null' }).trim().isLength({ max: 100 }),
    body('size').optional({ values: 'null' }).trim().isLength({ max: 50 }),
    body('sizeMm').optional({ values: 'falsy' }).isNumeric(),
    body('material').optional({ values: 'null' }).trim().isLength({ max: 100 }),
    body('brand').optional({ values: 'null' }).trim().isLength({ max: 255 }),
    body('quantity').optional({ values: 'falsy' }).isInt({ min: 0 }),
    body('craftType').optional({ values: 'null' }).trim().isLength({ max: 50 }),
    body('toolCategory').optional({ values: 'null' }).trim().isLength({ max: 100 }),
    body('cableLengthMm').optional({ values: 'falsy' }).isNumeric(),
    body('purchaseDate').optional({ values: 'falsy' }).isISO8601(),
    body('purchasePrice').optional({ values: 'falsy' }).isNumeric(),
    body('notes').optional({ values: 'null' }).isString(),
    body('taxonomyTypeId').optional({ values: 'falsy' }).isUUID(),
    body('taxonomyLabel').optional({ values: 'null' }).isString(),
    body('taxonomyCategoryLabel').optional({ values: 'null' }).isString(),
    body('taxonomySubcategoryLabel').optional({ values: 'null' }).isString(),
  ],
  validate,
  asyncHandler(toolsController.updateTool)
);

router.delete(
  '/:id',
  validateUUID('id'),
  asyncHandler(toolsController.deleteTool)
);

export default router;
