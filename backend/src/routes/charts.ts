import { Router } from 'express';
import { body, query } from 'express-validator';
import multer from 'multer';
import * as chartDetectionController from '../controllers/chartDetectionController';
import * as chartSharingController from '../controllers/chartSharingController';
import * as chartSymbolController from '../controllers/chartSymbolController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, WebP, PDF'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

/**
 * Chart Detection Routes
 */

/**
 * @route   POST /api/charts/detect-from-image
 * @desc    Detect chart from uploaded image
 * @access  Private
 */
router.post(
  '/detect-from-image',
  upload.single('image'),
  [body('project_id').optional({ values: 'null' }).isUUID()],
  validate,
  asyncHandler(chartDetectionController.detectFromImage)
);

/**
 * @route   GET /api/charts/detection/:detectionId
 * @desc    Get detection result
 * @access  Private
 */
router.get(
  '/detection/:detectionId',
  validateUUID('detectionId'),
  asyncHandler(chartDetectionController.getDetectionResult)
);

/**
 * @route   POST /api/charts/detection/:detectionId/correct
 * @desc    Apply corrections to detected chart
 * @access  Private
 */
router.post(
  '/detection/:detectionId/correct',
  [
    validateUUID('detectionId'),
    body('corrections').isArray().withMessage('Corrections must be an array'),
    body('corrections.*.row').isInt({ min: 0 }).withMessage('Row must be non-negative integer'),
    body('corrections.*.col').isInt({ min: 0 }).withMessage('Column must be non-negative integer'),
    body('corrections.*.corrected').isString().withMessage('Corrected symbol is required'),
  ],
  validate,
  asyncHandler(chartDetectionController.applyDetectionCorrections)
);

/**
 * @route   POST /api/charts/save-detected
 * @desc    Save detected chart to project
 * @access  Private
 */
router.post(
  '/save-detected',
  [
    body('detection_id').isUUID().withMessage('Detection ID is required'),
    body('project_id').optional({ values: 'null' }).isUUID(),
    body('pattern_id').optional({ values: 'null' }).isUUID(),
    body('chart_name').optional({ values: 'null' }).isString().isLength({ max: 255 }),
  ],
  validate,
  asyncHandler(chartDetectionController.saveDetectedChart)
);

/**
 * Stitch palette routes (system + user-custom symbols)
 */

/**
 * @route   GET /api/charts/symbols
 * @desc    Get symbol palette grouped into system + custom (optionally filtered by craft)
 * @access  Private
 */
router.get(
  '/symbols',
  [query('craft').optional({ values: 'falsy' }).isIn(['knit', 'crochet'])],
  validate,
  asyncHandler(chartSymbolController.getPalette)
);

/**
 * @route   GET /api/charts/symbols/lookup
 * @desc    Resolve a comma-separated list of symbols to their full template rows
 * @access  Private
 */
router.get(
  '/symbols/lookup',
  [query('symbols').isString().notEmpty()],
  validate,
  asyncHandler(chartSymbolController.getLookup)
);

/**
 * @route   POST /api/charts/symbols
 * @desc    Create a user-custom stitch
 * @access  Private
 */
router.post(
  '/symbols',
  [
    body('symbol').isString().trim().isLength({ min: 1, max: 10 }),
    body('name').isString().trim().isLength({ min: 1, max: 100 }),
    body('category').optional({ values: 'null' }).isString().isLength({ max: 50 }),
    body('description').optional({ values: 'null' }).isString(),
    body('abbreviation').optional({ values: 'null' }).isString().isLength({ max: 20 }),
    body('rs_instruction').optional({ values: 'null' }).isString(),
    body('ws_instruction').optional({ values: 'null' }).isString(),
    body('cell_span').optional({ values: 'falsy' }).isInt({ min: 1, max: 8 }),
    body('craft').optional({ values: 'falsy' }).isIn(['knit', 'crochet']),
  ],
  validate,
  asyncHandler(chartSymbolController.postSymbol)
);

/**
 * @route   PUT /api/charts/symbols/:id
 * @desc    Update a user-custom stitch
 * @access  Private
 */
router.put(
  '/symbols/:id',
  [
    validateUUID('id'),
    body('name').optional({ values: 'null' }).isString().isLength({ min: 1, max: 100 }),
    body('category').optional({ values: 'null' }).isString().isLength({ max: 50 }),
    body('description').optional({ values: 'null' }).isString(),
    body('abbreviation').optional({ values: 'null' }).isString().isLength({ max: 20 }),
    body('rs_instruction').optional({ values: 'null' }).isString(),
    body('ws_instruction').optional({ values: 'null' }).isString(),
    body('cell_span').optional({ values: 'falsy' }).isInt({ min: 1, max: 8 }),
    body('craft').optional({ values: 'falsy' }).isIn(['knit', 'crochet']),
  ],
  validate,
  asyncHandler(chartSymbolController.putSymbol)
);

/**
 * @route   DELETE /api/charts/symbols/:id
 * @desc    Delete a user-custom stitch
 * @access  Private
 */
router.delete(
  '/symbols/:id',
  validateUUID('id'),
  asyncHandler(chartSymbolController.deleteSymbol)
);

/**
 * @route   GET /api/charts/detections
 * @desc    Get user's detection history
 * @access  Private
 */
router.get(
  '/detections',
  [
    query('status').optional({ values: 'null' }).isIn(['pending', 'processing', 'completed', 'failed']),
    query('project_id').optional({ values: 'null' }).isUUID(),
    query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 100 }),
    query('offset').optional({ values: 'falsy' }).isInt({ min: 0 }),
  ],
  validate,
  asyncHandler(chartDetectionController.getDetectionHistory)
);

/**
 * @route   DELETE /api/charts/detection/:detectionId
 * @desc    Delete a detection
 * @access  Private
 */
router.delete(
  '/detection/:detectionId',
  validateUUID('detectionId'),
  asyncHandler(chartDetectionController.deleteDetection)
);

/**
 * Chart Sharing & Export Routes
 */

/**
 * @route   POST /api/charts/:chartId/share
 * @desc    Create shareable link for chart
 * @access  Private
 */
router.post(
  '/:chartId/share',
  [
    validateUUID('chartId'),
    body('visibility').optional({ values: 'null' }).isIn(['public', 'private']),
    body('allow_copy').optional({ values: 'falsy' }).isBoolean(),
    body('allow_download').optional({ values: 'falsy' }).isBoolean(),
    body('expires_in_days').optional({ values: 'falsy' }).isInt({ min: 1, max: 365 }),
    body('password').optional({ values: 'null' }).isString().isLength({ min: 4, max: 50 }),
  ],
  validate,
  asyncHandler(chartSharingController.shareChart)
);

/**
 * @route   POST /api/charts/:chartId/export
 * @desc    Export chart to specified format
 * @access  Private
 */
router.post(
  '/:chartId/export',
  [
    validateUUID('chartId'),
    body('format').isIn(['pdf', 'png', 'csv', 'ravelry', 'markdown']),
    body('options').optional({ values: 'null' }).isObject(),
  ],
  validate,
  asyncHandler(chartSharingController.exportChartHandler)
);

/**
 * @route   GET /api/shares
 * @desc    Get user's shared items
 * @access  Private
 */
router.get(
  '/shares',
  asyncHandler(chartSharingController.getMySharedItems)
);

/**
 * @route   GET /api/shares/stats
 * @desc    Get share statistics
 * @access  Private
 */
router.get(
  '/shares/stats',
  asyncHandler(chartSharingController.getShareStatistics)
);

/**
 * @route   DELETE /api/shares/:type/:token
 * @desc    Revoke a share link
 * @access  Private
 */
router.delete(
  '/shares/:type/:token',
  asyncHandler(chartSharingController.revokeShare)
);

/**
 * @route   GET /api/exports/history
 * @desc    Get export history
 * @access  Private
 */
router.get(
  '/exports/history',
  asyncHandler(chartSharingController.getExportHistory)
);

export default router;
