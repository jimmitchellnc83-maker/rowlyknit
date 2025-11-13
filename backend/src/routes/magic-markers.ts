import { Router } from 'express';
import { body } from 'express-validator';
import * as magicMarkersController from '../controllers/magicMarkersController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Magic Markers Routes
 */

/**
 * @route   GET /api/projects/:id/magic-markers
 * @desc    Get all magic markers for a project
 * @access  Private
 */
router.get(
  '/projects/:id/magic-markers',
  validateUUID('id'),
  asyncHandler(magicMarkersController.getMagicMarkers)
);

/**
 * @route   GET /api/projects/:id/magic-markers/:markerId
 * @desc    Get single magic marker by ID
 * @access  Private
 */
router.get(
  '/projects/:id/magic-markers/:markerId',
  [validateUUID('id'), validateUUID('markerId')],
  validate,
  asyncHandler(magicMarkersController.getMagicMarker)
);

/**
 * @route   POST /api/projects/:id/magic-markers
 * @desc    Create a magic marker
 * @access  Private
 */
router.post(
  '/projects/:id/magic-markers',
  [
    validateUUID('id'),
    body('counterId').optional().isUUID(),
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('triggerType').notEmpty().isIn(['counter_value', 'row_interval', 'stitch_count', 'time_based', 'custom']),
    body('triggerCondition').notEmpty().isObject(),
    body('alertMessage').notEmpty().isString(),
    body('alertType').optional().isIn(['notification', 'sound', 'vibration', 'visual']),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  asyncHandler(magicMarkersController.createMagicMarker)
);

/**
 * @route   PUT /api/projects/:id/magic-markers/:markerId
 * @desc    Update a magic marker
 * @access  Private
 */
router.put(
  '/projects/:id/magic-markers/:markerId',
  [validateUUID('id'), validateUUID('markerId')],
  validate,
  asyncHandler(magicMarkersController.updateMagicMarker)
);

/**
 * @route   DELETE /api/projects/:id/magic-markers/:markerId
 * @desc    Delete a magic marker
 * @access  Private
 */
router.delete(
  '/projects/:id/magic-markers/:markerId',
  [validateUUID('id'), validateUUID('markerId')],
  validate,
  asyncHandler(magicMarkersController.deleteMagicMarker)
);

/**
 * @route   PATCH /api/projects/:id/magic-markers/:markerId/toggle
 * @desc    Toggle magic marker active status
 * @access  Private
 */
router.patch(
  '/projects/:id/magic-markers/:markerId/toggle',
  [validateUUID('id'), validateUUID('markerId')],
  validate,
  asyncHandler(magicMarkersController.toggleMagicMarker)
);

export default router;
