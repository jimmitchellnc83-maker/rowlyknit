import { Router } from 'express';
import { body } from 'express-validator';
import * as notesController from '../controllers/notesController';
import { authenticate } from '../middleware/auth';
import { requireEntitlement } from '../middleware/requireEntitlement';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';
import { uploadAudioMiddleware, uploadHandwrittenMiddleware } from '../controllers/uploadsController';
import { ALLOWED_TEMPLATE_TYPES } from './notesTemplateTypes';

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
    body('patternId').optional({ values: 'null' }).isUUID(),
    body('transcription').optional({ values: 'null' }).isString().isLength({ max: 50000 }),
    body('durationSeconds').optional({ values: 'falsy' }).isNumeric(),
    body('title').optional({ values: 'null' }).isString().isLength({ max: 500 }),
    body('tags').optional({ values: 'null' }).isArray(),
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
  [
    validateUUID('id'),
    validateUUID('noteId'),
    body('transcription').optional({ values: 'null' }).isString().isLength({ max: 50000 }),
    body('patternId').optional({ values: 'null' }).isUUID(),
  ],
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
 * @route   GET /api/projects/:id/audio-notes/:noteId/stream
 * @desc    Stream the recorded audio file for an audio note
 * @access  Private
 */
router.get(
  '/projects/:id/audio-notes/:noteId/stream',
  [validateUUID('id'), validateUUID('noteId')],
  validate,
  asyncHandler(notesController.streamAudioNote)
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
router.get(
  '/projects/:id/structured-memos',
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
// `template_type` enum lives in a sibling file so unit tests can read
// the contract without pulling the full route module (and the auth
// middleware's JWT_SECRET requirement). See `notesTemplateTypes.ts`.

router.post(
  '/projects/:id/memos',
  requireEntitlement,
  [
    validateUUID('id'),
    body('templateType').notEmpty().isIn(ALLOWED_TEMPLATE_TYPES),
    body('data').notEmpty().isObject(),
    body('title').optional({ values: 'null' }).isString().isLength({ max: 500 }),
  ],
  validate,
  asyncHandler(notesController.createStructuredMemo)
);
router.post(
  '/projects/:id/structured-memos',
  requireEntitlement,
  [
    validateUUID('id'),
    body('templateType').notEmpty().isIn(ALLOWED_TEMPLATE_TYPES),
    body('data').notEmpty().isObject(),
    body('title').optional({ values: 'null' }).isString().isLength({ max: 500 }),
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
  [
    validateUUID('id'),
    validateUUID('memoId'),
    body('data').optional({ values: 'null' }).isObject(),
  ],
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
router.delete(
  '/projects/:id/structured-memos/:memoId',
  [validateUUID('id'), validateUUID('memoId')],
  validate,
  asyncHandler(notesController.deleteStructuredMemo)
);

/**
 * Text Notes Routes
 */

/**
 * @route   GET /api/projects/:id/text-notes
 * @desc    Get all text notes for a project
 * @access  Private
 */
router.get(
  '/projects/:id/text-notes',
  validateUUID('id'),
  asyncHandler(notesController.getTextNotes)
);

/**
 * @route   GET /api/projects/:id/text-notes/:noteId
 * @desc    Get single text note by ID
 * @access  Private
 */
router.get(
  '/projects/:id/text-notes/:noteId',
  [validateUUID('id'), validateUUID('noteId')],
  validate,
  asyncHandler(notesController.getTextNote)
);

/**
 * @route   POST /api/projects/:id/text-notes
 * @desc    Create a text note
 * @access  Private
 */
router.post(
  '/projects/:id/text-notes',
  [
    validateUUID('id'),
    body('content').notEmpty().isString().isLength({ max: 50000 }),
    body('title').optional({ values: 'null' }).isString().isLength({ max: 500 }),
    body('patternId').optional({ values: 'null' }).isUUID(),
    body('tags').optional({ values: 'null' }).isArray(),
    body('isPinned').optional({ values: 'falsy' }).isBoolean(),
  ],
  validate,
  asyncHandler(notesController.createTextNote)
);

/**
 * @route   PUT /api/projects/:id/text-notes/:noteId
 * @desc    Update a text note
 * @access  Private
 */
router.put(
  '/projects/:id/text-notes/:noteId',
  [
    validateUUID('id'),
    validateUUID('noteId'),
    body('title').optional({ values: 'null' }).isString().isLength({ max: 500 }),
    body('content').optional({ values: 'null' }).isString().isLength({ max: 50000 }),
    body('tags').optional({ values: 'null' }).isArray(),
    body('isPinned').optional({ values: 'falsy' }).isBoolean(),
    body('patternId').optional({ values: 'null' }).isUUID(),
  ],
  validate,
  asyncHandler(notesController.updateTextNote)
);

/**
 * @route   DELETE /api/projects/:id/text-notes/:noteId
 * @desc    Delete a text note
 * @access  Private
 */
router.delete(
  '/projects/:id/text-notes/:noteId',
  [validateUUID('id'), validateUUID('noteId')],
  validate,
  asyncHandler(notesController.deleteTextNote)
);

/**
 * Handwritten Notes Routes
 */

router.get(
  '/projects/:id/handwritten-notes',
  validateUUID('id'),
  asyncHandler(notesController.getHandwrittenNotes)
);

router.post(
  '/projects/:id/handwritten-notes',
  uploadHandwrittenMiddleware,
  [
    validateUUID('id'),
    body('patternId').optional({ values: 'null' }).isUUID(),
    body('pageNumber').optional({ values: 'falsy' }).isNumeric(),
    body('notes').optional({ values: 'null' }).isString().isLength({ max: 10000 }),
  ],
  validate,
  asyncHandler(notesController.createHandwrittenNote)
);

router.delete(
  '/projects/:id/handwritten-notes/:noteId',
  [validateUUID('id'), validateUUID('noteId')],
  validate,
  asyncHandler(notesController.deleteHandwrittenNote)
);

router.get(
  '/projects/:id/handwritten-notes/:noteId/image',
  [validateUUID('id'), validateUUID('noteId')],
  validate,
  asyncHandler(notesController.streamHandwrittenNote)
);

export default router;
