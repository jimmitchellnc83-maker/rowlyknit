import { Router } from 'express';
import { body } from 'express-validator';
import * as userExamplesController from '../controllers/userExamplesController';
import { ONBOARDING_GOALS } from '../controllers/userExamplesController';
import { authenticate } from '../middleware/auth';
import { validate } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();
router.use(authenticate);

/**
 * @route   GET /api/users/me/examples
 * @desc    Count + breakdown of example rows + tour status + onboarding goal for the current user.
 * @access  Private
 */
router.get('/me/examples', asyncHandler(userExamplesController.getExampleCount));

/**
 * @route   DELETE /api/users/me/examples
 * @desc    Clear all example rows for the current user.
 * @access  Private
 */
router.delete('/me/examples', asyncHandler(userExamplesController.clearExamples));

/**
 * @route   PUT /api/users/me/tour
 * @desc    Mark the guided tour as completed (or reset it).
 * @access  Private
 */
router.put(
  '/me/tour',
  [body('completed').optional({ values: 'null' }).isBoolean()],
  validate,
  asyncHandler(userExamplesController.setTourCompleted),
);

/**
 * @route   PUT /api/users/me/onboarding-goal
 * @desc    Persist the user's answer to the goal-pick card on Dashboard.
 * @access  Private
 */
router.put(
  '/me/onboarding-goal',
  [body('goal').optional({ values: 'null' }).isIn(ONBOARDING_GOALS as readonly string[])],
  validate,
  asyncHandler(userExamplesController.setOnboardingGoal),
);

export default router;
