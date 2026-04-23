import { Router } from 'express';
import { body } from 'express-validator';
import * as ratingsController from '../controllers/ratingsController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

router.use(authenticate);

/**
 * @route   GET /api/projects/:id/rating
 * @desc    Get the current user's rating for this project (or null)
 */
router.get(
  '/projects/:id/rating',
  validateUUID('id'),
  validate,
  asyncHandler(ratingsController.getProjectRating),
);

/**
 * @route   PUT /api/projects/:id/rating
 * @desc    Upsert the current user's rating for this project
 */
router.put(
  '/projects/:id/rating',
  [
    validateUUID('id'),
    body('rating').isInt({ min: 1, max: 5 }),
    body('notes').optional({ values: 'null' }).isString(),
    body('isPublic').optional().isBoolean(),
  ],
  validate,
  asyncHandler(ratingsController.upsertProjectRating),
);

/**
 * @route   DELETE /api/projects/:id/rating
 * @desc    Delete the current user's rating for this project
 */
router.delete(
  '/projects/:id/rating',
  validateUUID('id'),
  validate,
  asyncHandler(ratingsController.deleteProjectRating),
);

export default router;
