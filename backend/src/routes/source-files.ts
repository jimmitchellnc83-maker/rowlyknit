import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';
import * as sf from '../controllers/sourceFilesController';

const router = Router();
router.use(authenticate);

// POST /api/source-files
router.post(
  '/',
  sf.uploadSourceFileMiddleware,
  [
    body('craft').optional().isIn(['knit', 'crochet']),
    body('kind').optional().isIn(['pattern_pdf', 'chart_image', 'reference_doc']),
    body('projectId').optional().isUUID(),
    body('patternId').optional().isUUID(),
  ],
  validate,
  asyncHandler(sf.uploadSourceFile)
);

// GET /api/source-files
router.get(
  '/',
  [
    query('craft').optional().isIn(['knit', 'crochet']),
    query('kind').optional().isIn(['pattern_pdf', 'chart_image', 'reference_doc']),
  ],
  validate,
  asyncHandler(sf.listSourceFiles)
);

// GET /api/source-files/:id
router.get('/:id', validateUUID('id'), asyncHandler(sf.getSourceFile));

// GET /api/source-files/:id/file
router.get(
  '/:id/file',
  validateUUID('id'),
  asyncHandler(sf.streamSourceFileBytes)
);

// DELETE /api/source-files/:id
router.delete('/:id', validateUUID('id'), asyncHandler(sf.deleteSourceFile));

// POST /api/source-files/:id/crops
router.post(
  '/:id/crops',
  [
    validateUUID('id'),
    body('pageNumber').isInt({ min: 1 }),
    body('cropX').isFloat({ min: 0, max: 1 }),
    body('cropY').isFloat({ min: 0, max: 1 }),
    body('cropWidth').isFloat({ gt: 0, max: 1 }),
    body('cropHeight').isFloat({ gt: 0, max: 1 }),
    body('label').optional({ values: 'null' }).isString().isLength({ max: 120 }),
    body('patternId').optional({ values: 'null' }).isUUID(),
    body('patternSectionId').optional({ values: 'null' }).isString().isLength({ max: 64 }),
    body('metadata').optional({ values: 'null' }).isObject(),
  ],
  validate,
  asyncHandler(sf.createSourceFileCrop)
);

// GET /api/source-files/:id/crops
router.get(
  '/:id/crops',
  validateUUID('id'),
  asyncHandler(sf.listSourceFileCrops)
);

// PATCH /api/source-files/:id/crops/:cropId
router.patch(
  '/:id/crops/:cropId',
  [
    validateUUID('id'),
    validateUUID('cropId'),
    body('label').optional({ values: 'null' }).isString().isLength({ max: 120 }),
    body('chartId').optional({ values: 'null' }).isUUID(),
    body('metadata').optional({ values: 'null' }).isObject(),
    body('pageNumber').optional().isInt({ min: 1 }),
    body('cropX').optional().isFloat({ min: 0, max: 1 }),
    body('cropY').optional().isFloat({ min: 0, max: 1 }),
    body('cropWidth').optional().isFloat({ gt: 0, max: 1 }),
    body('cropHeight').optional().isFloat({ gt: 0, max: 1 }),
  ],
  validate,
  asyncHandler(sf.updateSourceFileCrop)
);

// DELETE /api/source-files/:id/crops/:cropId
router.delete(
  '/:id/crops/:cropId',
  [validateUUID('id'), validateUUID('cropId')],
  validate,
  asyncHandler(sf.deleteSourceFileCrop)
);

export default router;
