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
const countersController = __importStar(require("../controllers/countersController"));
const counterLinksController = __importStar(require("../controllers/counterLinksController"));
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const errorHandler_1 = require("../utils/errorHandler");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * Counter Routes
 */
/**
 * @route   GET /api/projects/:id/counters
 * @desc    Get all counters for a project
 * @access  Private
 */
router.get('/projects/:id/counters', (0, validator_1.validateUUID)('id'), (0, errorHandler_1.asyncHandler)(countersController.getCounters));
/**
 * @route   GET /api/projects/:id/counters/:counterId
 * @desc    Get single counter by ID
 * @access  Private
 */
router.get('/projects/:id/counters/:counterId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('counterId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(countersController.getCounter));
/**
 * @route   POST /api/projects/:id/counters
 * @desc    Create a new counter
 * @access  Private
 */
router.post('/projects/:id/counters', [
    (0, validator_1.validateUUID)('id'),
    (0, express_validator_1.body)('name').trim().notEmpty().isLength({ max: 255 }),
    (0, express_validator_1.body)('type').optional().isIn(['rows', 'stitches', 'repeats', 'custom']),
    (0, express_validator_1.body)('currentValue').optional().isNumeric(),
    (0, express_validator_1.body)('targetValue').optional().isNumeric(),
    (0, express_validator_1.body)('incrementBy').optional().isNumeric(),
    (0, express_validator_1.body)('minValue').optional().isNumeric(),
    (0, express_validator_1.body)('maxValue').optional().isNumeric(),
    (0, express_validator_1.body)('displayColor').optional().isString(),
    (0, express_validator_1.body)('isVisible').optional().isBoolean(),
    (0, express_validator_1.body)('incrementPattern').optional().isObject(),
    (0, express_validator_1.body)('sortOrder').optional().isNumeric(),
    (0, express_validator_1.body)('notes').optional().isString(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(countersController.createCounter));
/**
 * @route   PUT /api/projects/:id/counters/:counterId
 * @desc    Update a counter (including value changes)
 * @access  Private
 */
router.put('/projects/:id/counters/:counterId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('counterId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(countersController.updateCounter));
/**
 * @route   DELETE /api/projects/:id/counters/:counterId
 * @desc    Delete a counter
 * @access  Private
 */
router.delete('/projects/:id/counters/:counterId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('counterId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(countersController.deleteCounter));
/**
 * @route   PATCH /api/projects/:id/counters/reorder
 * @desc    Reorder counters
 * @access  Private
 */
router.patch('/projects/:id/counters/reorder', [(0, validator_1.validateUUID)('id'), (0, express_validator_1.body)('counters').isArray()], validator_1.validate, (0, errorHandler_1.asyncHandler)(countersController.reorderCounters));
/**
 * @route   GET /api/projects/:id/counters/:counterId/history
 * @desc    Get counter history
 * @access  Private
 */
router.get('/projects/:id/counters/:counterId/history', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('counterId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(countersController.getCounterHistory));
/**
 * @route   POST /api/projects/:id/counters/:counterId/undo/:historyId
 * @desc    Undo counter to a specific history point
 * @access  Private
 */
router.post('/projects/:id/counters/:counterId/undo/:historyId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('counterId'), (0, validator_1.validateUUID)('historyId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(countersController.undoCounterToPoint));
/**
 * Counter Links Routes
 */
/**
 * @route   GET /api/projects/:id/counters/:counterId/links
 * @desc    Get all links for a counter
 * @access  Private
 */
router.get('/projects/:id/counters/:counterId/links', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('counterId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(counterLinksController.getCounterLinks));
/**
 * @route   GET /api/projects/:id/counter-links
 * @desc    Get all counter links for a project
 * @access  Private
 */
router.get('/projects/:id/counter-links', (0, validator_1.validateUUID)('id'), (0, errorHandler_1.asyncHandler)(counterLinksController.getProjectLinks));
/**
 * @route   POST /api/projects/:id/counter-links
 * @desc    Create a counter link
 * @access  Private
 */
router.post('/projects/:id/counter-links', [
    (0, validator_1.validateUUID)('id'),
    (0, express_validator_1.body)('sourceCounterId').notEmpty().isUUID(),
    (0, express_validator_1.body)('targetCounterId').notEmpty().isUUID(),
    (0, express_validator_1.body)('linkType').optional().isString(),
    (0, express_validator_1.body)('triggerCondition').notEmpty().isObject(),
    (0, express_validator_1.body)('action').notEmpty().isObject(),
    (0, express_validator_1.body)('isActive').optional().isBoolean(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(counterLinksController.createCounterLink));
/**
 * @route   PUT /api/projects/:id/counter-links/:linkId
 * @desc    Update a counter link
 * @access  Private
 */
router.put('/projects/:id/counter-links/:linkId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('linkId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(counterLinksController.updateCounterLink));
/**
 * @route   DELETE /api/projects/:id/counter-links/:linkId
 * @desc    Delete a counter link
 * @access  Private
 */
router.delete('/projects/:id/counter-links/:linkId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('linkId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(counterLinksController.deleteCounterLink));
/**
 * @route   PATCH /api/projects/:id/counter-links/:linkId/toggle
 * @desc    Toggle counter link active status
 * @access  Private
 */
router.patch('/projects/:id/counter-links/:linkId/toggle', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('linkId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(counterLinksController.toggleCounterLink));
exports.default = router;
