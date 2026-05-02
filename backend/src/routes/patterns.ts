import { Router } from 'express';
import { body, param, query } from 'express-validator';
import * as patternsController from '../controllers/patternsController';
import * as blogImportController from '../controllers/blogImportController';
import * as patternExportController from '../controllers/patternExportController';
import * as gaugeAdjustmentController from '../controllers/gaugeAdjustmentController';
import { listPatternCrops as listPatternCropsHandler } from '../controllers/sourceFilesController';
import { listQuickKeysHandler } from '../controllers/annotationsController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID, validatePagination, validateSearch } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/patterns
 * @desc    Get all patterns for current user
 * @access  Private
 */
router.get(
  '/',
  validatePagination,
  validateSearch,
  asyncHandler(patternsController.getPatterns)
);

/**
 * @route   GET /api/patterns/stats
 * @desc    Get pattern statistics
 * @access  Private
 */
router.get('/stats', asyncHandler(patternsController.getPatternStats));

/**
 * @route   POST /api/patterns/collate
 * @desc    Collate multiple patterns into a single PDF
 * @access  Private
 */
router.post(
  '/collate',
  [
    body('patternIds').isArray({ min: 1 }).withMessage('Pattern IDs must be a non-empty array'),
    body('patternIds.*').isUUID().withMessage('Each pattern ID must be a valid UUID'),
    body('addDividers').optional({ values: 'falsy' }).isBoolean(),
    body('dividerText').optional().trim().isLength({ max: 255 }),
  ],
  validate,
  asyncHandler(patternsController.collatePatterns)
);

/**
 * @route   GET /api/patterns/collations/:collationId/download
 * @desc    Download a previously-collated multi-pattern PDF
 * @access  Private (owner only)
 */
router.get(
  '/collations/:collationId/download',
  [param('collationId').isUUID().withMessage('Collation ID must be a valid UUID')],
  validate,
  asyncHandler(patternsController.downloadPatternCollation)
);

/**
 * @route   GET /api/patterns/exports/:userId/:filename
 * @desc    Stream a previously-generated pattern-export PDF
 * @access  Private (path-encoded user must match req.user)
 */
router.get(
  '/exports/:userId/:filename',
  [
    param('userId').isUUID().withMessage('User ID must be a valid UUID'),
    param('filename')
      .matches(/^[a-f0-9]{32}\.pdf$/)
      .withMessage('Filename must be a 32-hex token with a .pdf suffix'),
  ],
  validate,
  asyncHandler(patternsController.downloadPatternExport)
);

/**
 * @route   POST /api/patterns/:id/export
 * @desc    Export pattern to PDF with yarn requirements
 * @access  Private
 */
router.post(
  '/:id/export',
  [
    validateUUID('id'),
    body('projectId').optional({ values: 'null' }).isUUID(),
    body('includeYarnRequirements').optional({ values: 'falsy' }).isBoolean(),
    body('includeSizeAdjustments').optional({ values: 'falsy' }).isBoolean(),
    body('includeNotes').optional({ values: 'falsy' }).isBoolean(),
    body('includeGauge').optional({ values: 'falsy' }).isBoolean(),
    body('selectedSize').optional({ values: 'null' }).isString().isLength({ max: 50 }),
    body('lengthAdjustment').optional({ values: 'falsy' }).isNumeric(),
    body('widthAdjustment').optional({ values: 'falsy' }).isNumeric(),
    body('adjustmentUnit').optional({ values: 'null' }).isIn(['inches', 'cm']),
  ],
  validate,
  asyncHandler(patternExportController.exportPattern)
);

/**
 * @route   POST /api/patterns/:id/calculate-yarn
 * @desc    Calculate adjusted yarn requirements without generating PDF
 * @access  Private
 */
router.post(
  '/:id/calculate-yarn',
  [
    validateUUID('id'),
    body('baseYardage').optional({ values: 'falsy' }).isNumeric(),
    body('lengthAdjustment').optional({ values: 'falsy' }).isNumeric(),
    body('widthAdjustment').optional({ values: 'falsy' }).isNumeric(),
    body('adjustmentUnit').optional({ values: 'null' }).isIn(['inches', 'cm']),
  ],
  validate,
  asyncHandler(patternExportController.calculateYarn)
);

/**
 * @route   POST /api/patterns/:patternId/calculate-adjustment
 * @desc    Calculate gauge adjustment for pattern
 * @access  Private
 */
router.post(
  '/:patternId/calculate-adjustment',
  [
    validateUUID('patternId'),
    body('pattern_gauge').isObject().withMessage('Pattern gauge is required'),
    body('pattern_gauge.stitches').isNumeric(),
    body('pattern_gauge.rows').isNumeric(),
    body('pattern_gauge.measurement').optional({ values: 'falsy' }).isNumeric(),
    body('actual_gauge').isObject().withMessage('Actual gauge is required'),
    body('actual_gauge.stitches').isNumeric(),
    body('actual_gauge.rows').isNumeric(),
    body('actual_gauge.measurement').optional({ values: 'falsy' }).isNumeric(),
  ],
  validate,
  asyncHandler(gaugeAdjustmentController.calculateAdjustment)
);

/**
 * Blog Import Routes
 */

/**
 * @route   POST /api/patterns/import-from-url
 * @desc    Extract pattern content from a blog URL
 * @access  Private
 */
router.post(
  '/import-from-url',
  [
    body('url').trim().notEmpty().isURL({ protocols: ['http', 'https'] })
      .withMessage('A valid URL is required'),
  ],
  validate,
  asyncHandler(blogImportController.extractFromUrl)
);

/**
 * @route   POST /api/patterns/save-imported
 * @desc    Save an imported pattern from extracted content
 * @access  Private
 */
router.post(
  '/save-imported',
  [
    body('importId').isUUID().withMessage('Import ID is required'),
    body('patternData').isObject().withMessage('Pattern data is required'),
    body('patternData.name').trim().notEmpty().isLength({ max: 255 })
      .withMessage('Pattern name is required'),
  ],
  validate,
  asyncHandler(blogImportController.saveImportedPattern)
);

/**
 * @route   GET /api/patterns/imports
 * @desc    Get import history for the user
 * @access  Private
 */
router.get(
  '/imports',
  [
    query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 100 }).toInt(),
  ],
  validate,
  asyncHandler(blogImportController.getImportHistory)
);

/**
 * @route   GET /api/patterns/imports/:importId
 * @desc    Get a specific import record
 * @access  Private
 */
router.get(
  '/imports/:importId',
  validateUUID('importId'),
  asyncHandler(blogImportController.getImport)
);

/**
 * @route   GET /api/patterns/:id
 * @desc    Get single pattern by ID
 * @access  Private
 */
router.get(
  '/:id',
  validateUUID('id'),
  asyncHandler(patternsController.getPattern)
);

/**
 * @route   GET /api/patterns/:id/charts
 * @desc    Get charts associated with a pattern
 * @access  Private
 * @note    Charts are currently linked to projects, not patterns directly.
 *          This returns an empty array until pattern-chart relationship is implemented.
 */
router.get(
  '/:id/charts',
  validateUUID('id'),
  asyncHandler(patternsController.getPatternCharts)
);

/**
 * @route   GET /api/patterns/:id/feasibility
 * @desc    Score a pattern against the user's stash + tools — traffic-light
 *          verdicts per requirement plus a shopping list for missing items.
 * @access  Private
 */
router.get(
  '/:id/feasibility',
  validateUUID('id'),
  asyncHandler(patternsController.getPatternFeasibility)
);

/**
 * @route   GET /api/patterns/:id/crops
 * @desc    List Wave 2 pattern_crops attached to this pattern
 * @access  Private
 */
router.get(
  '/:id/crops',
  validateUUID('id'),
  // Reuse the source-files controller — it reads req.params.patternId.
  // The mini-adapter renames the URL param so the route can stay /:id.
  asyncHandler(async (req, res) => {
    (req.params as Record<string, string>).patternId = req.params.id;
    return listPatternCropsHandler(req, res);
  })
);

/**
 * @route   GET /api/patterns/:id/quickkeys
 * @desc    List Wave 3 QuickKey crops for a pattern
 * @access  Private
 */
router.get(
  '/:id/quickkeys',
  validateUUID('id'),
  asyncHandler(async (req, res) => {
    (req.params as Record<string, string>).patternId = req.params.id;
    return listQuickKeysHandler(req, res);
  })
);

/**
 * @route   POST /api/patterns
 * @desc    Create new pattern
 * @access  Private
 */
router.post(
  '/',
  [
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().trim(),
    body('designer').optional().trim(),
    body('difficulty').optional().trim(),
    body('category').optional().trim(),
  ],
  validate,
  asyncHandler(patternsController.createPattern)
);

/**
 * @route   PUT /api/patterns/:id
 * @desc    Update pattern
 * @access  Private
 */
router.put(
  '/:id',
  [
    validateUUID('id'),
    body('name').optional().trim().isLength({ max: 255 }),
    body('description').optional({ values: 'null' }).isString(),
    body('designer').optional({ values: 'null' }).trim().isLength({ max: 255 }),
    body('source').optional({ values: 'null' }).trim().isLength({ max: 255 }),
    body('sourceUrl')
      .optional({ values: 'falsy' })
      .isURL({ protocols: ['http', 'https'], require_protocol: true }),
    body('difficulty').optional({ values: 'falsy' }).isString().isLength({ max: 50 }),
    body('category').optional({ values: 'falsy' }).isString().isLength({ max: 100 }),
    body('estimatedYardage').optional({ values: 'falsy' }).isNumeric(),
    body('notes').optional({ values: 'null' }).isString(),
    body('tags').optional({ values: 'null' }).isArray(),
    body('isFavorite').optional().isBoolean(),
  ],
  validate,
  asyncHandler(patternsController.updatePattern)
);

/**
 * @route   DELETE /api/patterns/:id
 * @desc    Delete pattern
 * @access  Private
 */
router.delete(
  '/:id',
  validateUUID('id'),
  asyncHandler(patternsController.deletePattern)
);

export default router;
