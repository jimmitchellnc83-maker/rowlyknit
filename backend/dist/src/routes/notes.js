"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const notesController = __importStar(require("../controllers/notesController"));
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const errorHandler_1 = require("../utils/errorHandler");
const uploadsController_1 = require("../controllers/uploadsController");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * Audio Notes Routes
 */
/**
 * @route   GET /api/projects/:id/audio-notes
 * @desc    Get all audio notes for a project
 * @access  Private
 */
router.get('/projects/:id/audio-notes', (0, validator_1.validateUUID)('id'), (0, errorHandler_1.asyncHandler)(notesController.getAudioNotes));
/**
 * @route   GET /api/projects/:id/audio-notes/:noteId
 * @desc    Get single audio note by ID
 * @access  Private
 */
router.get('/projects/:id/audio-notes/:noteId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('noteId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(notesController.getAudioNote));
/**
 * @route   POST /api/projects/:id/audio-notes
 * @desc    Create an audio note
 * @access  Private
 */
router.post('/projects/:id/audio-notes', uploadsController_1.uploadAudioMiddleware, [
    (0, validator_1.validateUUID)('id'),
    (0, express_validator_1.body)('patternId').optional().isUUID(),
    (0, express_validator_1.body)('transcription').optional().isString(),
    (0, express_validator_1.body)('durationSeconds').optional().isNumeric(),
    (0, express_validator_1.body)('title').optional().isString(),
    (0, express_validator_1.body)('tags').optional().isArray(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(notesController.createAudioNote));
/**
 * @route   PUT /api/projects/:id/audio-notes/:noteId
 * @desc    Update an audio note
 * @access  Private
 */
router.put('/projects/:id/audio-notes/:noteId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('noteId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(notesController.updateAudioNote));
/**
 * @route   DELETE /api/projects/:id/audio-notes/:noteId
 * @desc    Delete an audio note
 * @access  Private
 */
router.delete('/projects/:id/audio-notes/:noteId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('noteId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(notesController.deleteAudioNote));
/**
 * Structured Memos Routes
 */
/**
 * @route   GET /api/projects/:id/memos
 * @desc    Get all structured memos for a project
 * @access  Private
 */
router.get('/projects/:id/memos', (0, validator_1.validateUUID)('id'), (0, errorHandler_1.asyncHandler)(notesController.getStructuredMemos));
/**
 * @route   GET /api/projects/:id/memos/:memoId
 * @desc    Get single structured memo by ID
 * @access  Private
 */
router.get('/projects/:id/memos/:memoId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('memoId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(notesController.getStructuredMemo));
/**
 * @route   POST /api/projects/:id/memos
 * @desc    Create a structured memo
 * @access  Private
 */
router.post('/projects/:id/memos', [
    (0, validator_1.validateUUID)('id'),
    (0, express_validator_1.body)('templateType').notEmpty().isIn(['gauge_swatch', 'fit_adjustment', 'yarn_substitution', 'finishing']),
    (0, express_validator_1.body)('data').notEmpty().isObject(),
    (0, express_validator_1.body)('title').optional().isString(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(notesController.createStructuredMemo));
/**
 * @route   PUT /api/projects/:id/memos/:memoId
 * @desc    Update a structured memo
 * @access  Private
 */
router.put('/projects/:id/memos/:memoId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('memoId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(notesController.updateStructuredMemo));
/**
 * @route   DELETE /api/projects/:id/memos/:memoId
 * @desc    Delete a structured memo
 * @access  Private
 */
router.delete('/projects/:id/memos/:memoId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('memoId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(notesController.deleteStructuredMemo));
/**
 * Text Notes Routes
 */
/**
 * @route   GET /api/projects/:id/text-notes
 * @desc    Get all text notes for a project
 * @access  Private
 */
router.get('/projects/:id/text-notes', (0, validator_1.validateUUID)('id'), (0, errorHandler_1.asyncHandler)(notesController.getTextNotes));
/**
 * @route   GET /api/projects/:id/text-notes/:noteId
 * @desc    Get single text note by ID
 * @access  Private
 */
router.get('/projects/:id/text-notes/:noteId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('noteId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(notesController.getTextNote));
/**
 * @route   POST /api/projects/:id/text-notes
 * @desc    Create a text note
 * @access  Private
 */
router.post('/projects/:id/text-notes', [
    (0, validator_1.validateUUID)('id'),
    (0, express_validator_1.body)('content').notEmpty().isString(),
    (0, express_validator_1.body)('title').optional().isString(),
    (0, express_validator_1.body)('patternId').optional().isUUID(),
    (0, express_validator_1.body)('tags').optional().isArray(),
    (0, express_validator_1.body)('isPinned').optional().isBoolean(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(notesController.createTextNote));
/**
 * @route   PUT /api/projects/:id/text-notes/:noteId
 * @desc    Update a text note
 * @access  Private
 */
router.put('/projects/:id/text-notes/:noteId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('noteId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(notesController.updateTextNote));
/**
 * @route   DELETE /api/projects/:id/text-notes/:noteId
 * @desc    Delete a text note
 * @access  Private
 */
router.delete('/projects/:id/text-notes/:noteId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('noteId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(notesController.deleteTextNote));
exports.default = router;
