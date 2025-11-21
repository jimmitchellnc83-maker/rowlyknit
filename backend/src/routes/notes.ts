import { Router } from 'express';
import { body } from 'express-validator';
import multer from 'multer';
import * as notesController from '../controllers/notesController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';
import { uploadAudioMiddleware } from '../controllers/uploadsController';

const router = Router();

// Configure multer for handwritten note image uploads
const handwrittenImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'));
    }
  },
});

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
 * @route   GET /api/projects/:id/structured-memos (alias)
 * @desc    Get all structured memos for a project
 * @access  Private
 */
router.get(
  '/projects/:id/memos',
  validateUUID('id'),
  asyncHandler(notesController.getStructuredMemos)
);

// Alias route for frontend compatibility
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

// Alias route for frontend compatibility
router.get(
  '/projects/:id/structured-memos/:memoId',
  [validateUUID('id'), validateUUID('memoId')],
  validate,
  asyncHandler(notesController.getStructuredMemo)
);

/**
 * @route   POST /api/projects/:id/memos
 * @route   POST /api/projects/:id/structured-memos (alias)
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

// Alias route for frontend compatibility
router.post(
  '/projects/:id/structured-memos',
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

// Alias route for frontend compatibility
router.put(
  '/projects/:id/structured-memos/:memoId',
  [validateUUID('id'), validateUUID('memoId')],
  validate,
  asyncHandler(notesController.updateStructuredMemo)
);

/**
 * @route   DELETE /api/projects/:id/memos/:memoId
 * @route   DELETE /api/projects/:id/structured-memos/:memoId (alias)
 * @desc    Delete a structured memo
 * @access  Private
 */
router.delete(
  '/projects/:id/memos/:memoId',
  [validateUUID('id'), validateUUID('memoId')],
  validate,
  asyncHandler(notesController.deleteStructuredMemo)
);

// Alias route for frontend compatibility
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
    body('content').notEmpty().isString(),
    body('title').optional().isString(),
    body('patternId').optional().isUUID(),
    body('tags').optional().isArray(),
    body('isPinned').optional().isBoolean(),
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
  [validateUUID('id'), validateUUID('noteId')],
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

/**
 * @route   GET /api/projects/:id/handwritten-notes
 * @desc    Get all handwritten notes for a project
 * @access  Private
 */
router.get(
  '/projects/:id/handwritten-notes',
  validateUUID('id'),
  asyncHandler(notesController.getHandwrittenNotes)
);

/**
 * @route   GET /api/projects/:id/handwritten-notes/:noteId
 * @desc    Get single handwritten note by ID
 * @access  Private
 */
router.get(
  '/projects/:id/handwritten-notes/:noteId',
  [validateUUID('id'), validateUUID('noteId')],
  validate,
  asyncHandler(notesController.getHandwrittenNote)
);

/**
 * @route   POST /api/projects/:id/handwritten-notes
 * @desc    Create a handwritten note (image upload)
 * @access  Private
 */
router.post(
  '/projects/:id/handwritten-notes',
  handwrittenImageUpload.single('image'),
  [
    validateUUID('id'),
    body('title').optional().isString(),
  ],
  validate,
  asyncHandler(notesController.createHandwrittenNote)
);

/**
 * @route   DELETE /api/projects/:id/handwritten-notes/:noteId
 * @desc    Delete a handwritten note
 * @access  Private
 */
router.delete(
  '/projects/:id/handwritten-notes/:noteId',
  [validateUUID('id'), validateUUID('noteId')],
  validate,
  asyncHandler(notesController.deleteHandwrittenNote)
);

export default router;
