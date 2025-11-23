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
const sessionsController = __importStar(require("../controllers/sessionsController"));
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const errorHandler_1 = require("../utils/errorHandler");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * Session Routes
 */
/**
 * @route   GET /api/projects/:id/sessions
 * @desc    Get all sessions for a project
 * @access  Private
 */
router.get('/projects/:id/sessions', [(0, validator_1.validateUUID)('id'), validator_1.validatePagination], validator_1.validate, (0, errorHandler_1.asyncHandler)(sessionsController.getSessions));
/**
 * @route   GET /api/projects/:id/sessions/stats
 * @desc    Get session statistics for a project
 * @access  Private
 */
router.get('/projects/:id/sessions/stats', (0, validator_1.validateUUID)('id'), (0, errorHandler_1.asyncHandler)(sessionsController.getSessionStats));
/**
 * @route   GET /api/projects/:id/sessions/active
 * @desc    Get active session for a project
 * @access  Private
 */
router.get('/projects/:id/sessions/active', (0, validator_1.validateUUID)('id'), (0, errorHandler_1.asyncHandler)(sessionsController.getActiveSession));
/**
 * @route   GET /api/projects/:id/sessions/:sessionId
 * @desc    Get single session by ID
 * @access  Private
 */
router.get('/projects/:id/sessions/:sessionId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('sessionId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(sessionsController.getSession));
/**
 * @route   POST /api/projects/:id/sessions/start
 * @desc    Start a new knitting session
 * @access  Private
 */
router.post('/projects/:id/sessions/start', [
    (0, validator_1.validateUUID)('id'),
    (0, express_validator_1.body)('mood').optional().isString(),
    (0, express_validator_1.body)('location').optional().isString(),
    (0, express_validator_1.body)('notes').optional().isString(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(sessionsController.startSession));
/**
 * @route   POST /api/projects/:id/sessions/:sessionId/end
 * @desc    End a knitting session
 * @access  Private
 */
router.post('/projects/:id/sessions/:sessionId/end', [
    (0, validator_1.validateUUID)('id'),
    (0, validator_1.validateUUID)('sessionId'),
    (0, express_validator_1.body)('notes').optional().isString(),
    (0, express_validator_1.body)('mood').optional().isString(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(sessionsController.endSession));
/**
 * @route   PUT /api/projects/:id/sessions/:sessionId
 * @desc    Update a session
 * @access  Private
 */
router.put('/projects/:id/sessions/:sessionId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('sessionId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(sessionsController.updateSession));
/**
 * @route   DELETE /api/projects/:id/sessions/:sessionId
 * @desc    Delete a session
 * @access  Private
 */
router.delete('/projects/:id/sessions/:sessionId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('sessionId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(sessionsController.deleteSession));
/**
 * Milestone Routes
 */
/**
 * @route   GET /api/projects/:id/milestones
 * @desc    Get all milestones for a project
 * @access  Private
 */
router.get('/projects/:id/milestones', (0, validator_1.validateUUID)('id'), (0, errorHandler_1.asyncHandler)(sessionsController.getMilestones));
/**
 * @route   POST /api/projects/:id/milestones
 * @desc    Create a milestone
 * @access  Private
 */
router.post('/projects/:id/milestones', [
    (0, validator_1.validateUUID)('id'),
    (0, express_validator_1.body)('name').trim().notEmpty().isLength({ max: 255 }),
    (0, express_validator_1.body)('targetRows').optional().isNumeric(),
    (0, express_validator_1.body)('notes').optional().isString(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(sessionsController.createMilestone));
/**
 * @route   PUT /api/projects/:id/milestones/:milestoneId
 * @desc    Update a milestone
 * @access  Private
 */
router.put('/projects/:id/milestones/:milestoneId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('milestoneId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(sessionsController.updateMilestone));
/**
 * @route   DELETE /api/projects/:id/milestones/:milestoneId
 * @desc    Delete a milestone
 * @access  Private
 */
router.delete('/projects/:id/milestones/:milestoneId', [(0, validator_1.validateUUID)('id'), (0, validator_1.validateUUID)('milestoneId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(sessionsController.deleteMilestone));
exports.default = router;
