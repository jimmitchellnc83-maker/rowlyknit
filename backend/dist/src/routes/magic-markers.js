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
const magicMarkersController = __importStar(require("../controllers/magicMarkersController"));
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const errorHandler_1 = require("../utils/errorHandler");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * Magic Markers Routes
 */
/**
 * @route   GET /api/projects/:id/magic-markers
 * @desc    Get all magic markers for a project
 * @access  Private
 */
router.get('/projects/:id/magic-markers', (0, validator_1.validateUUID)('id'), (0, errorHandler_1.asyncHandler)(magicMarkersController.getMagicMarkers));
/**
 * @route   GET /api/projects/:id/magic-markers/:markerId
 * @desc    Get single magic marker by ID
 * @access  Private
 */
router.get('/projects/:id/magic-markers/:markerId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('markerId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(magicMarkersController.getMagicMarker));
/**
 * @route   POST /api/projects/:id/magic-markers
 * @desc    Create a magic marker
 * @access  Private
 */
router.post('/projects/:id/magic-markers', [
    (0, validator_1.validateUUID)('id'),
    (0, express_validator_1.body)('counterId').optional().isUUID(),
    (0, express_validator_1.body)('name').trim().notEmpty().isLength({ max: 255 }),
    (0, express_validator_1.body)('triggerType').notEmpty().isIn(['counter_value', 'row_interval', 'stitch_count', 'time_based', 'custom']),
    (0, express_validator_1.body)('triggerCondition').notEmpty().isObject(),
    (0, express_validator_1.body)('alertMessage').notEmpty().isString(),
    (0, express_validator_1.body)('alertType').optional().isIn(['notification', 'sound', 'vibration', 'visual']),
    (0, express_validator_1.body)('isActive').optional().isBoolean(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(magicMarkersController.createMagicMarker));
/**
 * @route   PUT /api/projects/:id/magic-markers/:markerId
 * @desc    Update a magic marker
 * @access  Private
 */
router.put('/projects/:id/magic-markers/:markerId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('markerId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(magicMarkersController.updateMagicMarker));
/**
 * @route   DELETE /api/projects/:id/magic-markers/:markerId
 * @desc    Delete a magic marker
 * @access  Private
 */
router.delete('/projects/:id/magic-markers/:markerId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('markerId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(magicMarkersController.deleteMagicMarker));
/**
 * @route   PATCH /api/projects/:id/magic-markers/:markerId/toggle
 * @desc    Toggle magic marker active status
 * @access  Private
 */
router.patch('/projects/:id/magic-markers/:markerId/toggle', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('markerId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(magicMarkersController.toggleMagicMarker));
exports.default = router;
