import { Router } from 'express';
import { body } from 'express-validator';
import * as notesController from '../controllers/notesController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';
import { uploadAudioMiddleware } from '../controllers/uploadsController';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * Audio Notes Routes
 */

/**
 * @route   GET /api/projects/:id/audio-notes
 * @desc    Get all audio notes for a project
 * @access  Private
 */
router.get(
  '/projects/:id/audio-notes',
  validateUUID('id'),
  asyncHandler(notesController.getAudioNotes)
);

/**
 * @route   GET /api/projects/:id/audio-notes/:noteId
 * @desc    Get single audio note by ID
 * @access  Private
 */
router.get(
  '/projects/:id/audio-notes/:noteId',
  [validateUUID('id'), validateUUID('noteId')],
  validate,
  asyncHandler(notesController.getAudioNote)
);

/**
 * @route   POST /api/projects/:id/audio-notes
 * @desc    Create an audio note
 * @access  Private
 */
router.post(
  '/projects/:id/audio-notes',
  uploadAudioMiddleware,
  [
    validateUUID('id'),
    body('patternId').optional().isUUID(),
    body('transcription').optional().isString(),
    body('durationSeconds').optional().isNumeric(),
    body('title').optional().isString(),
    body('tags').optional().isArray(),
  ],
  validate,
  asyncHandler(notesController.createAudioNote)
);

/**
 * @route   PUT /api/projects/:id/audio-notes/:noteId
 * @desc    Update an audio note
 * @access  Private
 */
router.put(
  '/projects/:id/audio-notes/:noteId',
  [validateUUID('id'), validateUUID('noteId')],
  validate,
  asyncHandler(notesController.updateAudioNote)
);

/**
 * @route   DELETE /api/projects/:id/audio-notes/:noteId
 * @desc    Delete an audio note
 * @access  Private
 */
router.delete(
  '/projects/:id/audio-notes/:noteId',
  [validateUUID('id'), validateUUID('noteId')],
  validate,
  asyncHandler(notesController.deleteAudioNote)
);

/**
 * Structured Memos Routes
 */

/**
 * @route   GET /api/projects/:id/memos
 * @desc    Get all structured memos for a project
 * @access  Private
 */
router.get(
  '/projects/:id/memos',
  validateUUID('id'),
  asyncHandler(notesController.getStructuredMemos)
);

/**
 * @route   GET /api/projects/:id/memos/:memoId
 * @desc    Get single structured memo by ID
 * @access  Private
 */
router.get(
  '/projects/:id/memos/:memoId',
  [validateUUID('id'), validateUUID('memoId')],
  validate,
  asyncHandler(notesController.getStructuredMemo)
);

/**
 * @route   POST /api/projects/:id/memos
 * @desc    Create a structured memo
 * @access  Private
 */
router.post(
  '/projects/:id/memos',
  [
    validateUUID('id'),
    body('templateType').notEmpty().isIn(['gauge_swatch', 'fit_adjustment', 'yarn_substitution', 'finishing']),
    body('data').notEmpty().isObject(),
    body('title').optional().isString(),
  ],
  validate,
  asyncHandler(notesController.createStructuredMemo)
);

/**
 * @route   PUT /api/projects/:id/memos/:memoId
 * @desc    Update a structured memo
 * @access  Private
 */
router.put(
  '/projects/:id/memos/:memoId',
  [validateUUID('id'), validateUUID('memoId')],
  validate,
  asyncHandler(notesController.updateStructuredMemo)
);

/**
 * @route   DELETE /api/projects/:id/memos/:memoId
 * @desc    Delete a structured memo
 * @access  Private
 */
router.delete(
  '/projects/:id/memos/:memoId',
  [validateUUID('id'), validateUUID('memoId')],
  validate,
  asyncHandler(notesController.deleteStructuredMemo)
);

export default router;
