import { Router } from 'express';
import { body } from 'express-validator';
import * as patternBookmarksController from '../controllers/patternBookmarksController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/patterns/:patternId/bookmarks
 * @desc    Get all bookmarks for a pattern
 * @access  Private
 * @query   projectId (optional) - filter by project
 */
router.get(
  '/patterns/:patternId/bookmarks',
  validateUUID('patternId'),
  asyncHandler(patternBookmarksController.getBookmarks)
);

/**
 * @route   GET /api/patterns/:patternId/bookmarks/:bookmarkId
 * @desc    Get single bookmark by ID
 * @access  Private
 */
router.get(
  '/patterns/:patternId/bookmarks/:bookmarkId',
  [validateUUID('patternId'), validateUUID('bookmarkId')],
  validate,
  asyncHandler(patternBookmarksController.getBookmark)
);

/**
 * @route   POST /api/patterns/:patternId/bookmarks
 * @desc    Create a new bookmark
 * @access  Private
 */
router.post(
  '/patterns/:patternId/bookmarks',
  [
    validateUUID('patternId'),
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('pageNumber').isInt({ min: 1 }),
    body('yPosition').optional().isInt(),
    body('zoomLevel').optional().isFloat({ min: 0.1, max: 5.0 }),
    body('notes').optional().isString(),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    body('projectId').optional().isUUID(),
    body('sortOrder').optional().isInt({ min: 0 }),
  ],
  validate,
  asyncHandler(patternBookmarksController.createBookmark)
);

/**
 * @route   PUT /api/patterns/:patternId/bookmarks/:bookmarkId
 * @desc    Update a bookmark
 * @access  Private
 */
router.put(
  '/patterns/:patternId/bookmarks/:bookmarkId',
  [validateUUID('patternId'), validateUUID('bookmarkId')],
  validate,
  asyncHandler(patternBookmarksController.updateBookmark)
);

/**
 * @route   DELETE /api/patterns/:patternId/bookmarks/:bookmarkId
 * @desc    Delete a bookmark
 * @access  Private
 */
router.delete(
  '/patterns/:patternId/bookmarks/:bookmarkId',
  [validateUUID('patternId'), validateUUID('bookmarkId')],
  validate,
  asyncHandler(patternBookmarksController.deleteBookmark)
);

/**
 * @route   PATCH /api/patterns/:patternId/bookmarks/reorder
 * @desc    Reorder bookmarks
 * @access  Private
 */
router.patch(
  '/patterns/:patternId/bookmarks/reorder',
  [validateUUID('patternId'), body('bookmarks').isArray()],
  validate,
  asyncHandler(patternBookmarksController.reorderBookmarks)
);

export default router;
