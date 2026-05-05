import { Router, Request, Response, NextFunction } from 'express';
import { body, query } from 'express-validator';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler, NotFoundError } from '../utils/errorHandler';
import * as sf from '../controllers/sourceFilesController';
import * as ann from '../controllers/annotationsController';
import * as ca from '../controllers/chartAlignmentController';
import { getCropForParent } from '../services/sourceFileService';

const router = Router();
router.use(authenticate);

/**
 * Parent-child invariant gate for `/:id/crops/:cropId/...` nested routes.
 *
 * Without this, the nested controllers (annotations, QuickKey, chart
 * alignment, Magic Marker) load by `:cropId` only and trust that the
 * URL parent was correct. A request like `/api/source-files/A/crops/B`
 * where crop B is attached to source file C would mutate the wrong
 * thing relative to what the URL claimed — even within a single user's
 * namespace this is a data-integrity issue (downstream joins / audit
 * logs / caches that key off the URL parent see a contradiction).
 *
 * Mount AFTER the validateUUID checks so we don't waste a DB roundtrip
 * on garbage IDs. Mount BEFORE any controller that mutates state.
 *
 * Returns 404 (not 403) so the response shape doesn't differentiate
 * "no permission" from "no row" — same contract every other ownership
 * gate in this codebase uses.
 */
const verifyCropBelongsToParent = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    const userId = req.user!.userId;
    const { id: sourceFileId, cropId } = req.params;
    const crop = await getCropForParent(sourceFileId, cropId, userId);
    if (!crop) throw new NotFoundError('Crop not found');
    next();
  },
);

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
//
// `verifyCropBelongsToParent` is also redundant with the controller's
// own `getCropForParent` call — kept on the route as defense in depth
// so a future refactor that changes the controller still can't bypass
// the parent gate. Same reasoning for DELETE below.
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
  verifyCropBelongsToParent,
  asyncHandler(sf.updateSourceFileCrop)
);

// DELETE /api/source-files/:id/crops/:cropId
router.delete(
  '/:id/crops/:cropId',
  [validateUUID('id'), validateUUID('cropId')],
  validate,
  verifyCropBelongsToParent,
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
  verifyCropBelongsToParent,
  asyncHandler(ann.createAnnotationHandler)
);

// GET /api/source-files/:id/crops/:cropId/annotations
router.get(
  '/:id/crops/:cropId/annotations',
  [validateUUID('id'), validateUUID('cropId')],
  validate,
  verifyCropBelongsToParent,
  asyncHandler(ann.listAnnotationsHandler)
);

// PATCH /api/source-files/:id/crops/:cropId/annotations/:annotationId
//
// Run `verifyCropBelongsToParent` BEFORE the :annotationId → :id rewrite
// so it sees the original `:id` (= sourceFileId) param. The wrapper
// then aliases :annotationId onto :id for the controller's uniform
// signature, AFTER the parent gate has fired.
router.patch(
  '/:id/crops/:cropId/annotations/:annotationId',
  [
    validateUUID('id'),
    validateUUID('cropId'),
    validateUUID('annotationId'),
    body('payload').optional().isObject(),
  ],
  validate,
  verifyCropBelongsToParent,
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
  verifyCropBelongsToParent,
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
  verifyCropBelongsToParent,
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
  verifyCropBelongsToParent,
  asyncHandler(ca.setAlignmentHandler)
);

// GET /api/source-files/:id/crops/:cropId/alignment
router.get(
  '/:id/crops/:cropId/alignment',
  [validateUUID('id'), validateUUID('cropId')],
  validate,
  verifyCropBelongsToParent,
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
  verifyCropBelongsToParent,
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
  verifyCropBelongsToParent,
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
  verifyCropBelongsToParent,
  asyncHandler(ca.confirmMatchesHandler)
);

export default router;
