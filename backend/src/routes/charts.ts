import { Router } from 'express';
import { body, query } from 'express-validator';
import multer from 'multer';
import * as chartDetectionController from '../controllers/chartDetectionController';
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
  [body('project_id').optional().isUUID()],
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
    body('project_id').optional().isUUID(),
    body('chart_name').optional().isString().isLength({ max: 255 }),
  ],
  validate,
  asyncHandler(chartDetectionController.saveDetectedChart)
);

/**
 * @route   GET /api/charts/symbols
 * @desc    Get symbol library
 * @access  Private
 */
router.get('/symbols', asyncHandler(chartDetectionController.getSymbols));

/**
 * @route   GET /api/charts/detections
 * @desc    Get user's detection history
 * @access  Private
 */
router.get(
  '/detections',
  [
    query('status').optional().isIn(['pending', 'processing', 'completed', 'failed']),
    query('project_id').optional().isUUID(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('offset').optional().isInt({ min: 0 }),
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

export default router;
