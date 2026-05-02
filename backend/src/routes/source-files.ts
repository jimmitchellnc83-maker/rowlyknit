import { Router } from 'express';
import { body, query } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';
import * as sf from '../controllers/sourceFilesController';
import * as ann from '../controllers/annotationsController';
import * as ca from '../controllers/chartAlignmentController';

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

// =========================
// Wave 3 — Annotations
// =========================

// POST /api/source-files/:id/crops/:cropId/annotations
router.post(
  '/:id/crops/:cropId/annotations',
  [
    validateUUID('id'),
    validateUUID('cropId'),
    body('annotationType').isIn(['pen', 'highlight', 'text', 'stamp']),
    body('payload').isObject(),
  ],
  validate,
  asyncHandler(ann.createAnnotationHandler)
);

// GET /api/source-files/:id/crops/:cropId/annotations
router.get(
  '/:id/crops/:cropId/annotations',
  [validateUUID('id'), validateUUID('cropId')],
  validate,
  asyncHandler(ann.listAnnotationsHandler)
);

// PATCH /api/source-files/:id/crops/:cropId/annotations/:annotationId
router.patch(
  '/:id/crops/:cropId/annotations/:annotationId',
  [
    validateUUID('id'),
    validateUUID('cropId'),
    validateUUID('annotationId'),
    body('payload').optional().isObject(),
  ],
  validate,
  // Re-route :annotationId → :id so the controller's signature is uniform.
  asyncHandler(async (req, res) => {
    (req.params as Record<string, string>).id = req.params.annotationId;
    return ann.updateAnnotationHandler(req, res);
  })
);

// DELETE /api/source-files/:id/crops/:cropId/annotations/:annotationId
router.delete(
  '/:id/crops/:cropId/annotations/:annotationId',
  [validateUUID('id'), validateUUID('cropId'), validateUUID('annotationId')],
  validate,
  asyncHandler(async (req, res) => {
    (req.params as Record<string, string>).id = req.params.annotationId;
    return ann.deleteAnnotationHandler(req, res);
  })
);

// =========================
// Wave 3 — QuickKey
// =========================

// PATCH /api/source-files/:id/crops/:cropId/quickkey
router.patch(
  '/:id/crops/:cropId/quickkey',
  [
    validateUUID('id'),
    validateUUID('cropId'),
    body('isQuickKey').isBoolean(),
    body('position').optional({ values: 'null' }).isInt({ min: 0 }),
    body('label').optional({ values: 'null' }).isString().isLength({ max: 120 }),
  ],
  validate,
  asyncHandler(ann.setQuickKeyHandler)
);

// =========================
// Wave 5 — Chart alignment + Magic Marker
// =========================

// PUT /api/source-files/:id/crops/:cropId/alignment
router.put(
  '/:id/crops/:cropId/alignment',
  [
    validateUUID('id'),
    validateUUID('cropId'),
    body('gridX').isFloat({ min: 0, max: 1 }),
    body('gridY').isFloat({ min: 0, max: 1 }),
    body('gridWidth').isFloat({ gt: 0, max: 1 }),
    body('gridHeight').isFloat({ gt: 0, max: 1 }),
    body('cellsAcross').isInt({ min: 1 }),
    body('cellsDown').isInt({ min: 1 }),
  ],
  validate,
  asyncHandler(ca.setAlignmentHandler)
);

// GET /api/source-files/:id/crops/:cropId/alignment
router.get(
  '/:id/crops/:cropId/alignment',
  [validateUUID('id'), validateUUID('cropId')],
  validate,
  asyncHandler(ca.getAlignmentHandler)
);

// POST /api/source-files/:id/crops/:cropId/magic-marker/sample
router.post(
  '/:id/crops/:cropId/magic-marker/sample',
  [
    validateUUID('id'),
    validateUUID('cropId'),
    body('chartAlignmentId').isUUID(),
    body('symbol').isString().isLength({ min: 1, max: 32 }),
    body('gridRow').isInt({ min: 0 }),
    body('gridCol').isInt({ min: 0 }),
    body('imageHash').optional({ values: 'null' }).isString().isLength({ max: 64 }),
    body('matchMetadata').optional({ values: 'null' }).isObject(),
  ],
  validate,
  asyncHandler(ca.recordSampleHandler)
);

// POST /api/source-files/:id/crops/:cropId/magic-marker/match
router.post(
  '/:id/crops/:cropId/magic-marker/match',
  [
    validateUUID('id'),
    validateUUID('cropId'),
    body('chartAlignmentId').isUUID(),
    body('targetHash').isString().isLength({ min: 1, max: 64 }),
    body('maxDistance').optional().isInt({ min: 0, max: 64 }),
  ],
  validate,
  asyncHandler(ca.findMatchesHandler)
);

// POST /api/source-files/:id/crops/:cropId/magic-marker/confirm
router.post(
  '/:id/crops/:cropId/magic-marker/confirm',
  [
    validateUUID('id'),
    validateUUID('cropId'),
    body('chartId').isUUID(),
    body('symbol').isString().isLength({ min: 1, max: 32 }),
    body('cells').isArray(),
  ],
  validate,
  asyncHandler(ca.confirmMatchesHandler)
);

export default router;
