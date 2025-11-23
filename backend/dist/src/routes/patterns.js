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
const patternsController = __importStar(require("../controllers/patternsController"));
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const errorHandler_1 = require("../utils/errorHandler");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * @route   GET /api/patterns
 * @desc    Get all patterns for current user
 * @access  Private
 */
router.get('/', validator_1.validatePagination, validator_1.validateSearch, (0, errorHandler_1.asyncHandler)(patternsController.getPatterns));
/**
 * @route   GET /api/patterns/stats
 * @desc    Get pattern statistics
 * @access  Private
 */
router.get('/stats', (0, errorHandler_1.asyncHandler)(patternsController.getPatternStats));
/**
 * @route   POST /api/patterns/collate
 * @desc    Collate multiple patterns into a single PDF
 * @access  Private
 */
router.post('/collate', [
    (0, express_validator_1.body)('patternIds').isArray({ min: 1 }).withMessage('Pattern IDs must be a non-empty array'),
    (0, express_validator_1.body)('patternIds.*').isUUID().withMessage('Each pattern ID must be a valid UUID'),
    (0, express_validator_1.body)('addDividers').optional().isBoolean(),
    (0, express_validator_1.body)('dividerText').optional().trim().isLength({ max: 255 }),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternsController.collatePatterns));
/**
 * @route   GET /api/patterns/:id
 * @desc    Get single pattern by ID
 * @access  Private
 */
router.get('/:id', (0, validator_1.validateUUID)('id'), (0, errorHandler_1.asyncHandler)(patternsController.getPattern));
/**
 * @route   POST /api/patterns
 * @desc    Create new pattern
 * @access  Private
 */
router.post('/', [
    (0, express_validator_1.body)('name').trim().notEmpty().isLength({ max: 255 }),
    (0, express_validator_1.body)('description').optional().trim(),
    (0, express_validator_1.body)('designer').optional().trim(),
    (0, express_validator_1.body)('difficulty').optional().trim(),
    (0, express_validator_1.body)('category').optional().trim(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(patternsController.createPattern));
/**
 * @route   PUT /api/patterns/:id
 * @desc    Update pattern
 * @access  Private
 */
router.put('/:id', (0, validator_1.validateUUID)('id'), (0, errorHandler_1.asyncHandler)(patternsController.updatePattern));
/**
 * @route   DELETE /api/patterns/:id
 * @desc    Delete pattern
 * @access  Private
 */
router.delete('/:id', (0, validator_1.validateUUID)('id'), (0, errorHandler_1.asyncHandler)(patternsController.deletePattern));
exports.default = router;
