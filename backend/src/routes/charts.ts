import { Router } from 'express';
import { body, query } from 'express-validator';
import multer from 'multer';
import * as chartController from '../controllers/chartController';
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
 * @route   GET /api/charts/detection/:detectionId/image
 * @desc    Stream the original uploaded chart image (auth + ownership)
 * @access  Private
 */
router.get(
  '/detection/:detectionId/image',
  validateUUID('detectionId'),
  asyncHandler(chartDetectionController.streamDetectionImage)
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
    body('format').isIn(['pdf', 'png', 'svg', 'csv', 'ravelry', 'markdown']),
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

/**
 * Personal chart library CRUD (Session 4 of the Designer roadmap).
 *
 * The wildcard `/:chartId` routes below MUST be declared after every
 * specific GET / POST / DELETE path that lives at /api/charts/...
 * (symbols, detection/..., shares, exports/history) — otherwise Express
 * will try the wildcard first and 404 with "Chart not found" on a path
 * that should have matched a specific handler.
 */

/**
 * @route   GET /api/charts
 * @desc    List the user's charts (active by default; ?archived=true
 *          flips to the archive). Supports ?projectId, ?patternId, ?q
 *          substring search, and ?limit/?offset pagination.
 * @access  Private
 */
router.get(
  '/',
  [
    query('archived').optional().isBoolean(),
    query('projectId').optional({ values: 'falsy' }).isUUID(),
    query('patternId').optional({ values: 'falsy' }).isUUID(),
    query('q').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
    query('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 200 }),
    query('offset').optional({ values: 'falsy' }).isInt({ min: 0 }),
  ],
  validate,
  asyncHandler(chartController.list)
);

/**
 * @route   POST /api/charts
 * @desc    Create a chart from grid data. project_id / pattern_id
 *          optional — leaving both null = library-only chart.
 * @access  Private
 */
router.post(
  '/',
  [
    body('name').isString().isLength({ min: 1, max: 255 }),
    body('grid').isObject(),
    body('description').optional({ values: 'null' }).isString().isLength({ max: 5000 }),
    body('project_id').optional({ values: 'null' }).isUUID(),
    body('pattern_id').optional({ values: 'null' }).isUUID(),
    body('source').optional({ values: 'null' }).isIn(['manual', 'image_import', 'duplicate']),
    body('symbol_legend').optional({ values: 'null' }).isObject(),
  ],
  validate,
  asyncHandler(chartController.create)
);

/**
 * @route   GET /api/charts/:chartId
 * @desc    Get a single chart (full grid + metadata).
 * @access  Private (chart owner only)
 */
router.get(
  '/:chartId',
  validateUUID('chartId'),
  asyncHandler(chartController.getOne)
);

/**
 * @route   PUT /api/charts/:chartId
 * @desc    Update name / description / grid / project / pattern / legend.
 * @access  Private (chart owner only)
 */
router.put(
  '/:chartId',
  [
    validateUUID('chartId'),
    body('name').optional({ values: 'falsy' }).isString().isLength({ min: 1, max: 255 }),
    body('grid').optional({ values: 'null' }).isObject(),
    body('description').optional({ values: 'null' }).isString().isLength({ max: 5000 }),
    body('project_id').optional({ values: 'null' }).isUUID(),
    body('pattern_id').optional({ values: 'null' }).isUUID(),
    body('symbol_legend').optional({ values: 'null' }).isObject(),
  ],
  validate,
  asyncHandler(chartController.update)
);

/**
 * @route   DELETE /api/charts/:chartId
 * @desc    Hard-delete a chart. Prefer POST /:chartId/archive for
 *          user-facing flows; this is the irreversible escape hatch.
 * @access  Private (chart owner only)
 */
router.delete(
  '/:chartId',
  validateUUID('chartId'),
  asyncHandler(chartController.remove)
);

/**
 * @route   POST /api/charts/:chartId/archive
 * @desc    Soft-archive (sets archived_at). Idempotent.
 * @access  Private (chart owner only)
 */
router.post(
  '/:chartId/archive',
  validateUUID('chartId'),
  asyncHandler(chartController.archive)
);

/**
 * @route   POST /api/charts/:chartId/restore
 * @desc    Un-archive (clears archived_at). Idempotent.
 * @access  Private (chart owner only)
 */
router.post(
  '/:chartId/restore',
  validateUUID('chartId'),
  asyncHandler(chartController.restore)
);

/**
 * @route   POST /api/charts/:chartId/duplicate
 * @desc    Copy a chart. The duplicate detaches from project / pattern
 *          (becomes a library-only chart) and gets a "(copy)" suffix.
 * @access  Private (chart owner only)
 */
router.post(
  '/:chartId/duplicate',
  validateUUID('chartId'),
  asyncHandler(chartController.duplicate)
);

export default router;
