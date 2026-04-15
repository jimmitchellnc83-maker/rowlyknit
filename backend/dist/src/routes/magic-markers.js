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
const markerAnalyticsController = __importStar(require("../controllers/markerAnalyticsController"));
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
 * @route   GET /api/projects/:id/magic-markers/active
 * @desc    Get active magic markers for a specific row
 * @access  Private
 */
router.get('/projects/:id/magic-markers/active', [
    (0, validator_1.validateUUID)('id'),
    (0, express_validator_1.query)('row').notEmpty().isNumeric(),
    (0, express_validator_1.query)('counterId').optional({ values: 'null' }).isUUID(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(magicMarkersController.getActiveMarkersForRow));
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
    (0, express_validator_1.body)('counterId').optional({ values: 'null' }).isUUID(),
    (0, express_validator_1.body)('name').trim().notEmpty().isLength({ max: 255 }),
    (0, express_validator_1.body)('triggerType').optional({ values: 'null' }).isIn(['counter_value', 'row_interval', 'row_range', 'stitch_count', 'time_based', 'custom', 'at_same_time']),
    (0, express_validator_1.body)('triggerCondition').optional({ values: 'null' }).isObject(),
    (0, express_validator_1.body)('alertMessage').notEmpty().isString(),
    (0, express_validator_1.body)('alertType').optional({ values: 'null' }).isIn(['notification', 'sound', 'vibration', 'visual']),
    (0, express_validator_1.body)('isActive').optional({ values: 'falsy' }).isBoolean(),
    // New enhanced fields
    (0, express_validator_1.body)('startRow').optional({ values: 'falsy' }).isNumeric(),
    (0, express_validator_1.body)('endRow').optional({ values: 'falsy' }).isNumeric(),
    (0, express_validator_1.body)('repeatInterval').optional({ values: 'falsy' }).isNumeric(),
    (0, express_validator_1.body)('repeatOffset').optional({ values: 'falsy' }).isNumeric(),
    (0, express_validator_1.body)('isRepeating').optional({ values: 'falsy' }).isBoolean(),
    (0, express_validator_1.body)('priority').optional({ values: 'null' }).isIn(['low', 'normal', 'high', 'critical']),
    (0, express_validator_1.body)('displayStyle').optional({ values: 'null' }).isIn(['banner', 'popup', 'toast', 'inline']),
    (0, express_validator_1.body)('color').optional({ values: 'null' }).isString(),
    (0, express_validator_1.body)('category').optional({ values: 'null' }).isIn(['reminder', 'at_same_time', 'milestone', 'shaping', 'note']),
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
/**
 * @route   POST /api/projects/:id/magic-markers/:markerId/snooze
 * @desc    Snooze a magic marker for a specified duration
 * @access  Private
 */
router.post('/projects/:id/magic-markers/:markerId/snooze', [
    (0, validator_1.validateUUID)('id'),
    (0, validator_1.validateUUID)('markerId'),
    (0, express_validator_1.body)('duration').notEmpty().isNumeric(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(magicMarkersController.snoozeMagicMarker));
/**
 * @route   POST /api/projects/:id/magic-markers/:markerId/complete
 * @desc    Mark a magic marker as completed
 * @access  Private
 */
router.post('/projects/:id/magic-markers/:markerId/complete', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('markerId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(magicMarkersController.completeMagicMarker));
/**
 * @route   POST /api/projects/:id/magic-markers/:markerId/trigger
 * @desc    Record that a magic marker was triggered
 * @access  Private
 */
router.post('/projects/:id/magic-markers/:markerId/trigger', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('markerId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(magicMarkersController.recordTrigger));
/**
 * Marker Analytics Routes
 */
/**
 * @route   POST /api/markers/:markerId/event
 * @desc    Record a marker event (triggered, snoozed, acknowledged, completed)
 * @access  Private
 */
router.post('/markers/:markerId/event', [
    (0, validator_1.validateUUID)('markerId'),
    (0, express_validator_1.body)('event_type').isIn(['triggered', 'snoozed', 'acknowledged', 'completed']),
    (0, express_validator_1.body)('at_row').optional({ values: 'falsy' }).isInt({ min: 0 }),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(markerAnalyticsController.recordMarkerEvent));
/**
 * @route   PATCH /api/markers/:markerId/position
 * @desc    Update marker position (for drag-and-drop)
 * @access  Private
 */
router.patch('/markers/:markerId/position', [
    (0, validator_1.validateUUID)('markerId'),
    (0, express_validator_1.body)('trigger_value').isInt({ min: 1 }),
    (0, express_validator_1.body)('end_value').optional({ values: 'falsy' }).isInt({ min: 1 }),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(markerAnalyticsController.updateMarkerPosition));
/**
 * @route   PATCH /api/markers/:markerId/color
 * @desc    Update marker color
 * @access  Private
 */
router.patch('/markers/:markerId/color', [
    (0, validator_1.validateUUID)('markerId'),
    (0, express_validator_1.body)('color').isIn(['blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink', 'gray']),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(markerAnalyticsController.updateMarkerColor));
exports.default = router;
