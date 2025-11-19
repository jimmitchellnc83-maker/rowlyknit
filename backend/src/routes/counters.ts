import { Router } from 'express';
import { body } from 'express-validator';
import * as countersController from '../controllers/countersController';
import * as counterLinksController from '../controllers/counterLinksController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Counter Routes
 */

/**
 * @route   GET /api/projects/:id/counters
 * @desc    Get all counters for a project
 * @access  Private
 */
router.get(
  '/projects/:id/counters',
  validateUUID('id'),
  asyncHandler(countersController.getCounters)
);

/**
 * @route   GET /api/projects/:id/counters/:counterId
 * @desc    Get single counter by ID
 * @access  Private
 */
router.get(
  '/projects/:id/counters/:counterId',
  [validateUUID('id'), validateUUID('counterId')],
  validate,
  asyncHandler(countersController.getCounter)
);

/**
 * @route   POST /api/projects/:id/counters
 * @desc    Create a new counter
 * @access  Private
 */
router.post(
  '/projects/:id/counters',
  [
    validateUUID('id'),
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('type').optional().isIn(['rows', 'stitches', 'repeats', 'custom']),
    body('currentValue').optional().isNumeric(),
    body('targetValue').optional().isNumeric(),
    body('incrementBy').optional().isNumeric(),
    body('minValue').optional().isNumeric(),
    body('maxValue').optional().isNumeric(),
    body('displayColor').optional().isString(),
    body('isVisible').optional().isBoolean(),
    body('incrementPattern').optional().isObject(),
    body('sortOrder').optional().isNumeric(),
    body('notes').optional().isString(),
  ],
  validate,
  asyncHandler(countersController.createCounter)
);

/**
 * @route   PUT /api/projects/:id/counters/:counterId
 * @desc    Update a counter (including value changes)
 * @access  Private
 */
router.put(
  '/projects/:id/counters/:counterId',
  [validateUUID('id'), validateUUID('counterId')],
  validate,
  asyncHandler(countersController.updateCounter)
);

/**
 * @route   DELETE /api/projects/:id/counters/:counterId
 * @desc    Delete a counter
 * @access  Private
 */
router.delete(
  '/projects/:id/counters/:counterId',
  [validateUUID('id'), validateUUID('counterId')],
  validate,
  asyncHandler(countersController.deleteCounter)
);

/**
 * @route   PATCH /api/projects/:id/counters/reorder
 * @desc    Reorder counters
 * @access  Private
 */
router.patch(
  '/projects/:id/counters/reorder',
  [validateUUID('id'), body('counters').isArray()],
  validate,
  asyncHandler(countersController.reorderCounters)
);

/**
 * @route   GET /api/projects/:id/counters/:counterId/history
 * @desc    Get counter history
 * @access  Private
 */
router.get(
  '/projects/:id/counters/:counterId/history',
  [validateUUID('id'), validateUUID('counterId')],
  validate,
  asyncHandler(countersController.getCounterHistory)
);

/**
 * @route   POST /api/projects/:id/counters/:counterId/undo/:historyId
 * @desc    Undo counter to a specific history point
 * @access  Private
 */
router.post(
  '/projects/:id/counters/:counterId/undo/:historyId',
  [validateUUID('id'), validateUUID('counterId'), validateUUID('historyId')],
  validate,
  asyncHandler(countersController.undoCounterToPoint)
);

/**
 * Counter Links Routes
 */

/**
 * @route   GET /api/projects/:id/counters/:counterId/links
 * @desc    Get all links for a counter
 * @access  Private
 */
router.get(
  '/projects/:id/counters/:counterId/links',
  [validateUUID('id'), validateUUID('counterId')],
  validate,
  asyncHandler(counterLinksController.getCounterLinks)
);

/**
 * @route   GET /api/projects/:id/counter-links
 * @desc    Get all counter links for a project
 * @access  Private
 */
router.get(
  '/projects/:id/counter-links',
  validateUUID('id'),
  asyncHandler(counterLinksController.getProjectLinks)
);

/**
 * @route   POST /api/projects/:id/counter-links
 * @desc    Create a counter link
 * @access  Private
 */
router.post(
  '/projects/:id/counter-links',
  [
    validateUUID('id'),
    body('sourceCounterId').notEmpty().isUUID(),
    body('targetCounterId').notEmpty().isUUID(),
    body('linkType').optional().isString(),
    body('triggerCondition').notEmpty().isObject(),
    body('action').notEmpty().isObject(),
    body('isActive').optional().isBoolean(),
  ],
  validate,
  asyncHandler(counterLinksController.createCounterLink)
);

/**
 * @route   PUT /api/projects/:id/counter-links/:linkId
 * @desc    Update a counter link
 * @access  Private
 */
router.put(
  '/projects/:id/counter-links/:linkId',
  [validateUUID('id'), validateUUID('linkId')],
  validate,
  asyncHandler(counterLinksController.updateCounterLink)
);

/**
 * @route   DELETE /api/projects/:id/counter-links/:linkId
 * @desc    Delete a counter link
 * @access  Private
 */
router.delete(
  '/projects/:id/counter-links/:linkId',
  [validateUUID('id'), validateUUID('linkId')],
  validate,
  asyncHandler(counterLinksController.deleteCounterLink)
);

/**
 * @route   PATCH /api/projects/:id/counter-links/:linkId/toggle
 * @desc    Toggle counter link active status
 * @access  Private
 */
router.patch(
  '/projects/:id/counter-links/:linkId/toggle',
  [validateUUID('id'), validateUUID('linkId')],
  validate,
  asyncHandler(counterLinksController.toggleCounterLink)
);

export default router;
