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
const patternBookmarksController = __importStar(require("../controllers/patternBookmarksController"));
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const errorHandler_1 = require("../utils/errorHandler");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * @route   GET /api/patterns/:patternId/bookmarks
 * @desc    Get all bookmarks for a pattern
 * @access  Private
 * @query   projectId (optional) - filter by project
 */
router.get('/patterns/:patternId/bookmarks', (0, validator_1.validateUUID)('patternId'), (0, errorHandler_1.asyncHandler)(patternBookmarksController.getBookmarks));
/**
 * @route   GET /api/patterns/:patternId/bookmarks/:bookmarkId
 * @desc    Get single bookmark by ID
 * @access  Private
 */
router.get('/patterns/:patternId/bookmarks/:bookmarkId', [(0, validator_1.validateUUID)('patternId'), (0, validator_1.validateUUID)('bookmarkId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternBookmarksController.getBookmark));
/**
 * @route   POST /api/patterns/:patternId/bookmarks
 * @desc    Create a new bookmark
 * @access  Private
 */
router.post('/patterns/:patternId/bookmarks', [
    (0, validator_1.validateUUID)('patternId'),
    (0, express_validator_1.body)('name').trim().notEmpty().isLength({ max: 255 }),
    (0, express_validator_1.body)('pageNumber').isInt({ min: 1 }),
    (0, express_validator_1.body)('yPosition').optional().isInt(),
    (0, express_validator_1.body)('zoomLevel').optional().isFloat({ min: 0.1, max: 5.0 }),
    (0, express_validator_1.body)('notes').optional().isString(),
    (0, express_validator_1.body)('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    (0, express_validator_1.body)('projectId').optional().isUUID(),
    (0, express_validator_1.body)('sortOrder').optional().isInt({ min: 0 }),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternBookmarksController.createBookmark));
/**
 * @route   PUT /api/patterns/:patternId/bookmarks/:bookmarkId
 * @desc    Update a bookmark
 * @access  Private
 */
router.put('/patterns/:patternId/bookmarks/:bookmarkId', [(0, validator_1.validateUUID)('patternId'), (0, validator_1.validateUUID)('bookmarkId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternBookmarksController.updateBookmark));
/**
 * @route   DELETE /api/patterns/:patternId/bookmarks/:bookmarkId
 * @desc    Delete a bookmark
 * @access  Private
 */
router.delete('/patterns/:patternId/bookmarks/:bookmarkId', [(0, validator_1.validateUUID)('patternId'), (0, validator_1.validateUUID)('bookmarkId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternBookmarksController.deleteBookmark));
/**
 * @route   PATCH /api/patterns/:patternId/bookmarks/reorder
 * @desc    Reorder bookmarks
 * @access  Private
 */
router.patch('/patterns/:patternId/bookmarks/reorder', [(0, validator_1.validateUUID)('patternId'), (0, express_validator_1.body)('bookmarks').isArray()], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternBookmarksController.reorderBookmarks));
exports.default = router;
