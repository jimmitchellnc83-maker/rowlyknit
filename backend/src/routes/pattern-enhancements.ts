import { Router } from 'express';
import { body } from 'express-validator';
import * as patternEnhancementsController from '../controllers/patternEnhancementsController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Legacy PDF/page-navigation section routes — these manage rows in the
 * `pattern_sections` table (page-anchor jump-points inside an uploaded
 * PDF). NOT canonical Pattern Model sections — for those see
 * /api/pattern-models/:id/sections in patternModelsController. See the
 * file-level comment in patternEnhancementsController for the full
 * legacy / canonical split.
 */

/**
 * @route   GET /api/patterns/:patternId/sections
 * @desc    List legacy PDF/page-navigation sections for a pattern.
 * @access  Private
 */
router.get(
  '/patterns/:patternId/sections',
  validateUUID('patternId'),
  asyncHandler(patternEnhancementsController.getPatternSections)
);

/**
 * @route   POST /api/patterns/:patternId/sections
 * @desc    Create a legacy PDF/page-navigation section.
 * @access  Private
 */
router.post(
  '/patterns/:patternId/sections',
  [
    validateUUID('patternId'),
    body('name').trim().notEmpty().isLength({ max: 255 }).escape(),
    body('pageNumber').optional({ values: 'falsy' }).isInt({ min: 1 }),
    body('yPosition').optional().isFloat(),
    body('sortOrder').optional({ values: 'falsy' }).isInt({ min: 0 }),
  ],
  validate,
  asyncHandler(patternEnhancementsController.createPatternSection)
);

/**
 * @route   PUT /api/patterns/:patternId/sections/:sectionId
 * @desc    Update a legacy PDF/page-navigation section.
 * @access  Private
 */
router.put(
  '/patterns/:patternId/sections/:sectionId',
  [
    validateUUID('patternId'),
    validateUUID('sectionId'),
    body('name').optional().trim().isLength({ max: 255 }).escape(),
    body('pageNumber').optional({ values: 'falsy' }).isInt({ min: 1 }),
    body('yPosition').optional().isFloat(),
    body('sortOrder').optional({ values: 'falsy' }).isInt({ min: 0 }),
  ],
  validate,
  asyncHandler(patternEnhancementsController.updatePatternSection)
);

/**
 * @route   DELETE /api/patterns/:patternId/sections/:sectionId
 * @desc    Delete a legacy PDF/page-navigation section.
 * @access  Private
 */
router.delete(
  '/patterns/:patternId/sections/:sectionId',
  [validateUUID('patternId'), validateUUID('sectionId')],
  validate,
  asyncHandler(patternEnhancementsController.deletePatternSection)
);

/**
 * Pattern Bookmarks Routes
 */

/**
 * @route   GET /api/patterns/:patternId/bookmarks
 * @desc    Get all bookmarks for a pattern
 * @access  Private
 */
router.get(
  '/patterns/:patternId/bookmarks',
  validateUUID('patternId'),
  asyncHandler(patternEnhancementsController.getPatternBookmarks)
);

/**
 * @route   POST /api/patterns/:patternId/bookmarks
 * @desc    Create a pattern bookmark
 * @access  Private
 */
router.post(
  '/patterns/:patternId/bookmarks',
  [
    validateUUID('patternId'),
    body('projectId').optional({ values: 'null' }).isUUID(),
    body('name').trim().notEmpty().isLength({ max: 255 }).escape(),
    body('pageNumber').notEmpty().isInt({ min: 1 }),
    body('yPosition').optional().isFloat(),
    body('zoomLevel').optional().isFloat({ min: 0.1, max: 5.0 }),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  ],
  validate,
  asyncHandler(patternEnhancementsController.createPatternBookmark)
);

/**
 * @route   PUT /api/patterns/:patternId/bookmarks/:bookmarkId
 * @desc    Update a pattern bookmark
 * @access  Private
 */
router.put(
  '/patterns/:patternId/bookmarks/:bookmarkId',
  [
    validateUUID('patternId'),
    validateUUID('bookmarkId'),
    body('projectId').optional({ values: 'null' }).isUUID(),
    body('name').optional().trim().isLength({ max: 255 }).escape(),
    body('pageNumber').optional({ values: 'falsy' }).isInt({ min: 1 }),
    body('yPosition').optional().isFloat(),
    body('zoomLevel').optional().isFloat({ min: 0.1, max: 5.0 }),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
  ],
  validate,
  asyncHandler(patternEnhancementsController.updatePatternBookmark)
);

/**
 * @route   DELETE /api/patterns/:patternId/bookmarks/:bookmarkId
 * @desc    Delete a pattern bookmark
 * @access  Private
 */
router.delete(
  '/patterns/:patternId/bookmarks/:bookmarkId',
  [validateUUID('patternId'), validateUUID('bookmarkId')],
  validate,
  asyncHandler(patternEnhancementsController.deletePatternBookmark)
);

/**
 * @route   PATCH /api/patterns/:patternId/bookmarks/reorder
 * @desc    Reorder pattern bookmarks (bulk sort_order update)
 * @access  Private
 */
router.patch(
  '/patterns/:patternId/bookmarks/reorder',
  [validateUUID('patternId'), body('bookmarks').isArray()],
  validate,
  asyncHandler(patternEnhancementsController.reorderPatternBookmarks)
);

/**
 * Pattern Highlights Routes
 */

/**
 * @route   GET /api/patterns/:patternId/highlights
 * @desc    Get all highlights for a pattern
 * @access  Private
 */
router.get(
  '/patterns/:patternId/highlights',
  validateUUID('patternId'),
  asyncHandler(patternEnhancementsController.getPatternHighlights)
);

/**
 * @route   POST /api/patterns/:patternId/highlights
 * @desc    Create a pattern highlight
 * @access  Private
 */
router.post(
  '/patterns/:patternId/highlights',
  [
    validateUUID('patternId'),
    body('projectId').optional({ values: 'null' }).isUUID(),
    body('pageNumber').notEmpty().isInt({ min: 1 }),
    body('coordinates').notEmpty().isObject(),
    body('coordinates.x').isFloat(),
    body('coordinates.y').isFloat(),
    body('coordinates.width').isFloat({ min: 0 }),
    body('coordinates.height').isFloat({ min: 0 }),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('opacity').optional().isFloat({ min: 0, max: 1 }),
  ],
  validate,
  asyncHandler(patternEnhancementsController.createPatternHighlight)
);

/**
 * @route   PUT /api/patterns/:patternId/highlights/:highlightId
 * @desc    Update a pattern highlight
 * @access  Private
 */
router.put(
  '/patterns/:patternId/highlights/:highlightId',
  [
    validateUUID('patternId'),
    validateUUID('highlightId'),
    body('projectId').optional({ values: 'null' }).isUUID(),
    body('pageNumber').optional({ values: 'falsy' }).isInt({ min: 1 }),
    body('coordinates').optional({ values: 'null' }).isObject(),
    body('coordinates.x').optional().isFloat(),
    body('coordinates.y').optional().isFloat(),
    body('coordinates.width').optional().isFloat({ min: 0 }),
    body('coordinates.height').optional().isFloat({ min: 0 }),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('opacity').optional().isFloat({ min: 0, max: 1 }),
  ],
  validate,
  asyncHandler(patternEnhancementsController.updatePatternHighlight)
);

/**
 * @route   DELETE /api/patterns/:patternId/highlights/:highlightId
 * @desc    Delete a pattern highlight
 * @access  Private
 */
router.delete(
  '/patterns/:patternId/highlights/:highlightId',
  [validateUUID('patternId'), validateUUID('highlightId')],
  validate,
  asyncHandler(patternEnhancementsController.deletePatternHighlight)
);

/**
 * Pattern Annotations Routes
 */

/**
 * @route   GET /api/patterns/:patternId/annotations
 * @desc    Get all annotations for a pattern
 * @access  Private
 */
router.get(
  '/patterns/:patternId/annotations',
  validateUUID('patternId'),
  asyncHandler(patternEnhancementsController.getPatternAnnotations)
);

/**
 * @route   POST /api/patterns/:patternId/annotations
 * @desc    Create a pattern annotation
 * @access  Private
 */
router.post(
  '/patterns/:patternId/annotations',
  [
    validateUUID('patternId'),
    body('projectId').optional({ values: 'null' }).isUUID(),
    body('pageNumber').optional({ values: 'falsy' }).isInt({ min: 1 }),
    body('annotationType').notEmpty().isIn(['text', 'drawing', 'handwriting', 'image', 'note']),
    body('data').optional({ values: 'null' }).isObject(),
    body('imageUrl').optional({ values: 'null' }).isURL({ protocols: ['http', 'https'], require_protocol: true }),
  ],
  validate,
  asyncHandler(patternEnhancementsController.createPatternAnnotation)
);

/**
 * @route   PUT /api/patterns/:patternId/annotations/:annotationId
 * @desc    Update a pattern annotation
 * @access  Private
 */
router.put(
  '/patterns/:patternId/annotations/:annotationId',
  [
    validateUUID('patternId'),
    validateUUID('annotationId'),
    body('projectId').optional({ values: 'null' }).isUUID(),
    body('pageNumber').optional({ values: 'falsy' }).isInt({ min: 1 }),
    body('annotationType').optional({ values: 'null' }).isIn(['text', 'drawing', 'handwriting', 'image']),
    body('data').optional({ values: 'null' }).isObject(),
    body('imageUrl').optional({ values: 'null' }).isURL({ protocols: ['http', 'https'], require_protocol: true }),
  ],
  validate,
  asyncHandler(patternEnhancementsController.updatePatternAnnotation)
);

/**
 * @route   DELETE /api/patterns/:patternId/annotations/:annotationId
 * @desc    Delete a pattern annotation
 * @access  Private
 */
router.delete(
  '/patterns/:patternId/annotations/:annotationId',
  [validateUUID('patternId'), validateUUID('annotationId')],
  validate,
  asyncHandler(patternEnhancementsController.deletePatternAnnotation)
);

export default router;
