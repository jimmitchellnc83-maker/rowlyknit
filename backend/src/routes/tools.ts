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
  validateUUID('id'),
  asyncHandler(toolsController.updateTool)
);

router.delete(
  '/:id',
  validateUUID('id'),
  asyncHandler(toolsController.deleteTool)
);

export default router;
