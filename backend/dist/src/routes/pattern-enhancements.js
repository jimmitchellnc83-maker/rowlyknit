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
const patternEnhancementsController = __importStar(require("../controllers/patternEnhancementsController"));
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const errorHandler_1 = require("../utils/errorHandler");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * Pattern Sections Routes
 */
/**
 * @route   GET /api/patterns/:patternId/sections
 * @desc    Get all sections for a pattern
 * @access  Private
 */
router.get('/patterns/:patternId/sections', (0, validator_1.validateUUID)('patternId'), (0, errorHandler_1.asyncHandler)(patternEnhancementsController.getPatternSections));
/**
 * @route   POST /api/patterns/:patternId/sections
 * @desc    Create a pattern section
 * @access  Private
 */
router.post('/patterns/:patternId/sections', [
    (0, validator_1.validateUUID)('patternId'),
    (0, express_validator_1.body)('name').trim().notEmpty().isLength({ max: 255 }),
    (0, express_validator_1.body)('pageNumber').optional().isNumeric(),
    (0, express_validator_1.body)('yPosition').optional().isNumeric(),
    (0, express_validator_1.body)('sortOrder').optional().isNumeric(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternEnhancementsController.createPatternSection));
/**
 * @route   PUT /api/patterns/:patternId/sections/:sectionId
 * @desc    Update a pattern section
 * @access  Private
 */
router.put('/patterns/:patternId/sections/:sectionId', [(0, validator_1.validateUUID)('patternId'), (0, validator_1.validateUUID)('sectionId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternEnhancementsController.updatePatternSection));
/**
 * @route   DELETE /api/patterns/:patternId/sections/:sectionId
 * @desc    Delete a pattern section
 * @access  Private
 */
router.delete('/patterns/:patternId/sections/:sectionId', [(0, validator_1.validateUUID)('patternId'), (0, validator_1.validateUUID)('sectionId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternEnhancementsController.deletePatternSection));
/**
 * Pattern Bookmarks Routes
 */
/**
 * @route   GET /api/patterns/:patternId/bookmarks
 * @desc    Get all bookmarks for a pattern
 * @access  Private
 */
router.get('/patterns/:patternId/bookmarks', (0, validator_1.validateUUID)('patternId'), (0, errorHandler_1.asyncHandler)(patternEnhancementsController.getPatternBookmarks));
/**
 * @route   POST /api/patterns/:patternId/bookmarks
 * @desc    Create a pattern bookmark
 * @access  Private
 */
router.post('/patterns/:patternId/bookmarks', [
    (0, validator_1.validateUUID)('patternId'),
    (0, express_validator_1.body)('projectId').optional().isUUID(),
    (0, express_validator_1.body)('name').trim().notEmpty().isLength({ max: 255 }),
    (0, express_validator_1.body)('pageNumber').notEmpty().isNumeric(),
    (0, express_validator_1.body)('yPosition').optional().isNumeric(),
    (0, express_validator_1.body)('zoomLevel').optional().isNumeric(),
    (0, express_validator_1.body)('color').optional().isString(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternEnhancementsController.createPatternBookmark));
/**
 * @route   PUT /api/patterns/:patternId/bookmarks/:bookmarkId
 * @desc    Update a pattern bookmark
 * @access  Private
 */
router.put('/patterns/:patternId/bookmarks/:bookmarkId', [(0, validator_1.validateUUID)('patternId'), (0, validator_1.validateUUID)('bookmarkId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternEnhancementsController.updatePatternBookmark));
/**
 * @route   DELETE /api/patterns/:patternId/bookmarks/:bookmarkId
 * @desc    Delete a pattern bookmark
 * @access  Private
 */
router.delete('/patterns/:patternId/bookmarks/:bookmarkId', [(0, validator_1.validateUUID)('patternId'), (0, validator_1.validateUUID)('bookmarkId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternEnhancementsController.deletePatternBookmark));
/**
 * Pattern Highlights Routes
 */
/**
 * @route   GET /api/patterns/:patternId/highlights
 * @desc    Get all highlights for a pattern
 * @access  Private
 */
router.get('/patterns/:patternId/highlights', (0, validator_1.validateUUID)('patternId'), (0, errorHandler_1.asyncHandler)(patternEnhancementsController.getPatternHighlights));
/**
 * @route   POST /api/patterns/:patternId/highlights
 * @desc    Create a pattern highlight
 * @access  Private
 */
router.post('/patterns/:patternId/highlights', [
    (0, validator_1.validateUUID)('patternId'),
    (0, express_validator_1.body)('projectId').optional().isUUID(),
    (0, express_validator_1.body)('pageNumber').notEmpty().isNumeric(),
    (0, express_validator_1.body)('coordinates').notEmpty().isObject(),
    (0, express_validator_1.body)('color').optional().isString(),
    (0, express_validator_1.body)('opacity').optional().isNumeric(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternEnhancementsController.createPatternHighlight));
/**
 * @route   PUT /api/patterns/:patternId/highlights/:highlightId
 * @desc    Update a pattern highlight
 * @access  Private
 */
router.put('/patterns/:patternId/highlights/:highlightId', [(0, validator_1.validateUUID)('patternId'), (0, validator_1.validateUUID)('highlightId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternEnhancementsController.updatePatternHighlight));
/**
 * @route   DELETE /api/patterns/:patternId/highlights/:highlightId
 * @desc    Delete a pattern highlight
 * @access  Private
 */
router.delete('/patterns/:patternId/highlights/:highlightId', [(0, validator_1.validateUUID)('patternId'), (0, validator_1.validateUUID)('highlightId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternEnhancementsController.deletePatternHighlight));
/**
 * Pattern Annotations Routes
 */
/**
 * @route   GET /api/patterns/:patternId/annotations
 * @desc    Get all annotations for a pattern
 * @access  Private
 */
router.get('/patterns/:patternId/annotations', (0, validator_1.validateUUID)('patternId'), (0, errorHandler_1.asyncHandler)(patternEnhancementsController.getPatternAnnotations));
/**
 * @route   POST /api/patterns/:patternId/annotations
 * @desc    Create a pattern annotation
 * @access  Private
 */
router.post('/patterns/:patternId/annotations', [
    (0, validator_1.validateUUID)('patternId'),
    (0, express_validator_1.body)('projectId').optional().isUUID(),
    (0, express_validator_1.body)('pageNumber').notEmpty().isNumeric(),
    (0, express_validator_1.body)('annotationType').notEmpty().isIn(['text', 'drawing', 'handwriting', 'image']),
    (0, express_validator_1.body)('data').optional().isObject(),
    (0, express_validator_1.body)('imageUrl').optional().isString(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternEnhancementsController.createPatternAnnotation));
/**
 * @route   PUT /api/patterns/:patternId/annotations/:annotationId
 * @desc    Update a pattern annotation
 * @access  Private
 */
router.put('/patterns/:patternId/annotations/:annotationId', [(0, validator_1.validateUUID)('patternId'), (0, validator_1.validateUUID)('annotationId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternEnhancementsController.updatePatternAnnotation));
/**
 * @route   DELETE /api/patterns/:patternId/annotations/:annotationId
 * @desc    Delete a pattern annotation
 * @access  Private
 */
router.delete('/patterns/:patternId/annotations/:annotationId', [(0, validator_1.validateUUID)('patternId'), (0, validator_1.validateUUID)('annotationId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternEnhancementsController.deletePatternAnnotation));
exports.default = router;
