import { Router } from 'express';
import { body, query } from 'express-validator';
import * as magicMarkersController from '../controllers/magicMarkersController';
import * as markerAnalyticsController from '../controllers/markerAnalyticsController';
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
 * @route   GET /api/projects/:id/magic-markers/active
 * @desc    Get active magic markers for a specific row
 * @access  Private
 */
router.get(
  '/projects/:id/magic-markers/active',
  [
    validateUUID('id'),
    query('row').notEmpty().isNumeric(),
    query('counterId').optional().isUUID(),
  ],
  validate,
  asyncHandler(magicMarkersController.getActiveMarkersForRow)
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
    body('triggerType').optional().isIn(['counter_value', 'row_interval', 'row_range', 'stitch_count', 'time_based', 'custom', 'at_same_time']),
    body('triggerCondition').optional().isObject(),
    body('alertMessage').notEmpty().isString(),
    body('alertType').optional().isIn(['notification', 'sound', 'vibration', 'visual']),
    body('isActive').optional().isBoolean(),
    // New enhanced fields
    body('startRow').optional().isNumeric(),
    body('endRow').optional().isNumeric(),
    body('repeatInterval').optional().isNumeric(),
    body('repeatOffset').optional().isNumeric(),
    body('isRepeating').optional().isBoolean(),
    body('priority').optional().isIn(['low', 'normal', 'high', 'critical']),
    body('displayStyle').optional().isIn(['banner', 'popup', 'toast', 'inline']),
    body('color').optional().isString(),
    body('category').optional().isIn(['reminder', 'at_same_time', 'milestone', 'shaping', 'note']),
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

/**
 * @route   POST /api/projects/:id/magic-markers/:markerId/snooze
 * @desc    Snooze a magic marker for a specified duration
 * @access  Private
 */
router.post(
  '/projects/:id/magic-markers/:markerId/snooze',
  [
    validateUUID('id'),
    validateUUID('markerId'),
    body('duration').notEmpty().isNumeric(),
  ],
  validate,
  asyncHandler(magicMarkersController.snoozeMagicMarker)
);

/**
 * @route   POST /api/projects/:id/magic-markers/:markerId/complete
 * @desc    Mark a magic marker as completed
 * @access  Private
 */
router.post(
  '/projects/:id/magic-markers/:markerId/complete',
  [validateUUID('id'), validateUUID('markerId')],
  validate,
  asyncHandler(magicMarkersController.completeMagicMarker)
);

/**
 * @route   POST /api/projects/:id/magic-markers/:markerId/trigger
 * @desc    Record that a magic marker was triggered
 * @access  Private
 */
router.post(
  '/projects/:id/magic-markers/:markerId/trigger',
  [validateUUID('id'), validateUUID('markerId')],
  validate,
  asyncHandler(magicMarkersController.recordTrigger)
);

/**
 * Marker Analytics Routes
 */

/**
 * @route   POST /api/markers/:markerId/event
 * @desc    Record a marker event (triggered, snoozed, acknowledged, completed)
 * @access  Private
 */
router.post(
  '/markers/:markerId/event',
  [
    validateUUID('markerId'),
    body('event_type').isIn(['triggered', 'snoozed', 'acknowledged', 'completed']),
    body('at_row').optional().isInt({ min: 0 }),
  ],
  validate,
  asyncHandler(markerAnalyticsController.recordMarkerEvent)
);

/**
 * @route   PATCH /api/markers/:markerId/position
 * @desc    Update marker position (for drag-and-drop)
 * @access  Private
 */
router.patch(
  '/markers/:markerId/position',
  [
    validateUUID('markerId'),
    body('trigger_value').isInt({ min: 1 }),
    body('end_value').optional().isInt({ min: 1 }),
  ],
  validate,
  asyncHandler(markerAnalyticsController.updateMarkerPosition)
);

/**
 * @route   PATCH /api/markers/:markerId/color
 * @desc    Update marker color
 * @access  Private
 */
router.patch(
  '/markers/:markerId/color',
  [
    validateUUID('markerId'),
    body('color').isIn(['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink', 'gray']),
  ],
  validate,
  asyncHandler(markerAnalyticsController.updateMarkerColor)
);

export default router;
