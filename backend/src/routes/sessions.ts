import { Router } from 'express';
import { body } from 'express-validator';
import * as sessionsController from '../controllers/sessionsController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID, validatePagination } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Session Routes
 */

/**
 * @route   GET /api/projects/:id/sessions
 * @desc    Get all sessions for a project
 * @access  Private
 */
router.get(
  '/projects/:id/sessions',
  [validateUUID('id'), validatePagination],
  validate,
  asyncHandler(sessionsController.getSessions)
);

/**
 * @route   GET /api/projects/:id/sessions/stats
 * @desc    Get session statistics for a project
 * @access  Private
 */
router.get(
  '/projects/:id/sessions/stats',
  validateUUID('id'),
  asyncHandler(sessionsController.getSessionStats)
);

/**
 * @route   GET /api/projects/:id/sessions/:sessionId
 * @desc    Get single session by ID
 * @access  Private
 */
router.get(
  '/projects/:id/sessions/:sessionId',
  [validateUUID('id'), validateUUID('sessionId')],
  validate,
  asyncHandler(sessionsController.getSession)
);

/**
 * @route   POST /api/projects/:id/sessions/start
 * @desc    Start a new knitting session
 * @access  Private
 */
router.post(
  '/projects/:id/sessions/start',
  [
    validateUUID('id'),
    body('mood').optional().isString(),
    body('location').optional().isString(),
    body('notes').optional().isString(),
  ],
  validate,
  asyncHandler(sessionsController.startSession)
);

/**
 * @route   POST /api/projects/:id/sessions/:sessionId/end
 * @desc    End a knitting session
 * @access  Private
 */
router.post(
  '/projects/:id/sessions/:sessionId/end',
  [
    validateUUID('id'),
    validateUUID('sessionId'),
    body('notes').optional().isString(),
    body('mood').optional().isString(),
  ],
  validate,
  asyncHandler(sessionsController.endSession)
);

/**
 * @route   PUT /api/projects/:id/sessions/:sessionId
 * @desc    Update a session
 * @access  Private
 */
router.put(
  '/projects/:id/sessions/:sessionId',
  [validateUUID('id'), validateUUID('sessionId')],
  validate,
  asyncHandler(sessionsController.updateSession)
);

/**
 * @route   DELETE /api/projects/:id/sessions/:sessionId
 * @desc    Delete a session
 * @access  Private
 */
router.delete(
  '/projects/:id/sessions/:sessionId',
  [validateUUID('id'), validateUUID('sessionId')],
  validate,
  asyncHandler(sessionsController.deleteSession)
);

/**
 * Milestone Routes
 */

/**
 * @route   GET /api/projects/:id/milestones
 * @desc    Get all milestones for a project
 * @access  Private
 */
router.get(
  '/projects/:id/milestones',
  validateUUID('id'),
  asyncHandler(sessionsController.getMilestones)
);

/**
 * @route   POST /api/projects/:id/milestones
 * @desc    Create a milestone
 * @access  Private
 */
router.post(
  '/projects/:id/milestones',
  [
    validateUUID('id'),
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('targetRows').optional().isNumeric(),
    body('notes').optional().isString(),
  ],
  validate,
  asyncHandler(sessionsController.createMilestone)
);

/**
 * @route   PUT /api/projects/:id/milestones/:milestoneId
 * @desc    Update a milestone
 * @access  Private
 */
router.put(
  '/projects/:id/milestones/:milestoneId',
  [validateUUID('id'), validateUUID('milestoneId')],
  validate,
  asyncHandler(sessionsController.updateMilestone)
);

/**
 * @route   DELETE /api/projects/:id/milestones/:milestoneId
 * @desc    Delete a milestone
 * @access  Private
 */
router.delete(
  '/projects/:id/milestones/:milestoneId',
  [validateUUID('id'), validateUUID('milestoneId')],
  validate,
  asyncHandler(sessionsController.deleteMilestone)
);

export default router;
