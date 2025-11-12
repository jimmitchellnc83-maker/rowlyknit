import { Router } from 'express';
import { body } from 'express-validator';
import * as patternsController from '../controllers/patternsController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID, validatePagination, validateSearch } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/patterns
 * @desc    Get all patterns for current user
 * @access  Private
 */
router.get(
  '/',
  validatePagination,
  validateSearch,
  asyncHandler(patternsController.getPatterns)
);

/**
 * @route   GET /api/patterns/stats
 * @desc    Get pattern statistics
 * @access  Private
 */
router.get('/stats', asyncHandler(patternsController.getPatternStats));

/**
 * @route   GET /api/patterns/:id
 * @desc    Get single pattern by ID
 * @access  Private
 */
router.get(
  '/:id',
  validateUUID('id'),
  asyncHandler(patternsController.getPattern)
);

/**
 * @route   POST /api/patterns
 * @desc    Create new pattern
 * @access  Private
 */
router.post(
  '/',
  [
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().trim(),
    body('designer').optional().trim(),
    body('difficulty').optional().trim(),
    body('category').optional().trim(),
  ],
  validate,
  asyncHandler(patternsController.createPattern)
);

/**
 * @route   PUT /api/patterns/:id
 * @desc    Update pattern
 * @access  Private
 */
router.put(
  '/:id',
  validateUUID('id'),
  asyncHandler(patternsController.updatePattern)
);

/**
 * @route   DELETE /api/patterns/:id
 * @desc    Delete pattern
 * @access  Private
 */
router.delete(
  '/:id',
  validateUUID('id'),
  asyncHandler(patternsController.deletePattern)
);

export default router;
