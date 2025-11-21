import { Router } from 'express';
import { body, query } from 'express-validator';
import multer from 'multer';
import * as colorPlanningController from '../controllers/colorPlanningController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPEG, PNG, GIF, WebP'));
    }
  },
});

// All routes require authentication
router.use(authenticate);

/**
 * Color Planning Routes
 */

/**
 * @route   POST /api/projects/:projectId/gradient-designer
 * @desc    Generate gradient color sequence
 * @access  Private
 */
router.post(
  '/projects/:projectId/gradient-designer',
  [
    validateUUID('projectId'),
    body('total_rows').isInt({ min: 1, max: 10000 }),
    body('colors').isArray({ min: 1, max: 10 }),
    body('colors.*.name').optional().isString(),
    body('colors.*.hex').isString().matches(/^#[0-9A-Fa-f]{6}$/),
    body('transition_style').isIn(['linear', 'smooth', 'striped']),
    body('stripe_width').optional().isInt({ min: 1, max: 100 }),
  ],
  validate,
  asyncHandler(colorPlanningController.designGradient)
);

/**
 * @route   POST /api/projects/:projectId/color-transitions
 * @desc    Save color transition plan
 * @access  Private
 */
router.post(
  '/projects/:projectId/color-transitions',
  [
    validateUUID('projectId'),
    body('name').optional().isString().isLength({ max: 100 }),
    body('transition_type').optional().isIn(['gradient', 'stripe', 'fair_isle', 'intarsia']),
    body('color_sequence').isArray(),
    body('total_rows').optional().isInt({ min: 1 }),
  ],
  validate,
  asyncHandler(colorPlanningController.saveColorTransition)
);

/**
 * @route   GET /api/projects/:projectId/color-transitions
 * @desc    Get color transitions for project
 * @access  Private
 */
router.get(
  '/projects/:projectId/color-transitions',
  validateUUID('projectId'),
  asyncHandler(colorPlanningController.getColorTransitions)
);

/**
 * @route   POST /api/projects/:projectId/extract-colors-from-image
 * @desc    Extract color palette from uploaded image
 * @access  Private
 */
router.post(
  '/projects/:projectId/extract-colors-from-image',
  upload.single('image'),
  [
    body('num_colors').optional().isInt({ min: 2, max: 10 }),
    body('save_palette').optional().isBoolean(),
    body('palette_name').optional().isString().isLength({ max: 100 }),
  ],
  validate,
  asyncHandler(colorPlanningController.extractColors)
);

/**
 * @route   GET /api/projects/:projectId/color-requirements
 * @desc    Calculate yarn requirements per color
 * @access  Private
 */
router.get(
  '/projects/:projectId/color-requirements',
  validateUUID('projectId'),
  asyncHandler(colorPlanningController.getColorRequirements)
);

/**
 * @route   POST /api/projects/:projectId/colors
 * @desc    Add color to project
 * @access  Private
 */
router.post(
  '/projects/:projectId/colors',
  [
    validateUUID('projectId'),
    body('color_name').isString().isLength({ min: 1, max: 100 }),
    body('hex_code').isString().matches(/^#[0-9A-Fa-f]{6}$/),
    body('yarn_id').optional().isUUID(),
    body('estimated_yardage').optional().isNumeric(),
  ],
  validate,
  asyncHandler(colorPlanningController.addProjectColor)
);

/**
 * @route   GET /api/projects/:projectId/colors
 * @desc    Get project colors
 * @access  Private
 */
router.get(
  '/projects/:projectId/colors',
  validateUUID('projectId'),
  asyncHandler(colorPlanningController.getProjectColors)
);

/**
 * @route   POST /api/color-palette/generate
 * @desc    Generate harmonious color palette
 * @access  Private
 */
router.post(
  '/color-palette/generate',
  [
    body('base_color').isString().matches(/^#[0-9A-Fa-f]{6}$/),
    body('scheme').isIn(['analogous', 'complementary', 'triadic', 'monochromatic', 'split_complementary']),
    body('save').optional().isBoolean(),
    body('name').optional().isString().isLength({ max: 100 }),
  ],
  validate,
  asyncHandler(colorPlanningController.generatePalette)
);

/**
 * @route   GET /api/color-palettes
 * @desc    Get user's saved palettes
 * @access  Private
 */
router.get(
  '/color-palettes',
  [query('project_id').optional().isUUID()],
  validate,
  asyncHandler(colorPlanningController.getSavedPalettes)
);

export default router;
