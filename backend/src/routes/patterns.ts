import { Router } from 'express';
import { body, query } from 'express-validator';
import * as patternsController from '../controllers/patternsController';
import * as blogImportController from '../controllers/blogImportController';
import * as patternExportController from '../controllers/patternExportController';
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
    body('addDividers').optional().isBoolean(),
    body('dividerText').optional().trim().isLength({ max: 255 }),
  ],
  validate,
  asyncHandler(patternsController.collatePatterns)
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
    body('projectId').optional().isUUID(),
    body('includeYarnRequirements').optional().isBoolean(),
    body('includeSizeAdjustments').optional().isBoolean(),
    body('includeNotes').optional().isBoolean(),
    body('includeGauge').optional().isBoolean(),
    body('selectedSize').optional().isString().isLength({ max: 50 }),
    body('lengthAdjustment').optional().isNumeric(),
    body('widthAdjustment').optional().isNumeric(),
    body('adjustmentUnit').optional().isIn(['inches', 'cm']),
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
    body('baseYardage').optional().isNumeric(),
    body('lengthAdjustment').optional().isNumeric(),
    body('widthAdjustment').optional().isNumeric(),
    body('adjustmentUnit').optional().isIn(['inches', 'cm']),
  ],
  validate,
  asyncHandler(patternExportController.calculateYarn)
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
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
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
  validateUUID('id'),
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
