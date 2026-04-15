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
const projectsController = __importStar(require("../controllers/projectsController"));
const gaugeAdjustmentController = __importStar(require("../controllers/gaugeAdjustmentController"));
const chartProgressController = __importStar(require("../controllers/chartProgressController"));
const markerAnalyticsController = __importStar(require("../controllers/markerAnalyticsController"));
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const errorHandler_1 = require("../utils/errorHandler");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
/**
 * @route   GET /api/projects/types
 * @desc    Get allowed project types
 * @access  Private
 */
router.get('/types', (0, errorHandler_1.asyncHandler)(projectsController.getProjectTypes));
/**
 * @route   GET /api/projects
 * @desc    Get all projects for current user
 * @access  Private
 */
router.get('/', validator_1.validatePagination, validator_1.validateSearch, (0, errorHandler_1.asyncHandler)(projectsController.getProjects));
/**
 * @route   GET /api/projects/stats
 * @desc    Get project statistics
 * @access  Private
 */
router.get('/stats', (0, errorHandler_1.asyncHandler)(projectsController.getProjectStats));
/**
 * @route   GET /api/projects/:id
 * @desc    Get single project by ID
 * @access  Private
 */
router.get('/:id', (0, validator_1.validateUUID)('id'), (0, errorHandler_1.asyncHandler)(projectsController.getProject));
/**
 * @route   POST /api/projects
 * @desc    Create new project
 * @access  Private
 */
router.post('/', [
    (0, express_validator_1.body)('name').trim().notEmpty().isLength({ max: 255 }),
    (0, express_validator_1.body)('description').optional().trim(),
    (0, express_validator_1.body)('projectType').optional().trim(),
    (0, express_validator_1.body)('startDate').optional({ values: 'falsy' }).isISO8601(),
    (0, express_validator_1.body)('targetCompletionDate').optional({ values: 'falsy' }).isISO8601(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(projectsController.createProject));
/**
 * @route   PUT /api/projects/:id
 * @desc    Update project
 * @access  Private
 */
router.put('/:id', (0, validator_1.validateUUID)('id'), (0, errorHandler_1.asyncHandler)(projectsController.updateProject));
/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete project
 * @access  Private
 */
router.delete('/:id', (0, validator_1.validateUUID)('id'), (0, errorHandler_1.asyncHandler)(projectsController.deleteProject));
/**
 * @route   POST /api/projects/:id/yarn
 * @desc    Add yarn to project with automatic stash deduction
 * @access  Private
 */
router.post('/:id/yarn', [
    (0, validator_1.validateUUID)('id'),
    (0, express_validator_1.body)('yarnId').notEmpty().isUUID(),
    (0, express_validator_1.body)('yardsUsed').optional({ values: 'falsy' }).isNumeric(),
    (0, express_validator_1.body)('skeinsUsed').optional({ values: 'falsy' }).isNumeric(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(projectsController.addYarnToProject));
/**
 * @route   PUT /api/projects/:id/yarn/:yarnId
 * @desc    Update yarn usage in project with automatic stash adjustment
 * @access  Private
 */
router.put('/:id/yarn/:yarnId', [
    (0, validator_1.validateUUID)('id'),
    (0, validator_1.validateUUID)('yarnId'),
    (0, express_validator_1.body)('yardsUsed').optional({ values: 'falsy' }).isNumeric(),
    (0, express_validator_1.body)('skeinsUsed').optional({ values: 'falsy' }).isNumeric(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(projectsController.updateProjectYarn));
/**
 * @route   DELETE /api/projects/:id/yarn/:yarnId
 * @desc    Remove yarn from project with stash restoration
 * @access  Private
 */
router.delete('/:id/yarn/:yarnId', [
    (0, validator_1.validateUUID)('id'),
    (0, validator_1.validateUUID)('yarnId'),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(projectsController.removeYarnFromProject));
/**
 * @route   POST /api/projects/:id/patterns
 * @desc    Add pattern to project
 * @access  Private
 */
router.post('/:id/patterns', [
    (0, validator_1.validateUUID)('id'),
    (0, express_validator_1.body)('patternId').notEmpty().isUUID(),
    (0, express_validator_1.body)('modifications').optional({ values: 'null' }).isString(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(projectsController.addPatternToProject));
/**
 * @route   DELETE /api/projects/:id/patterns/:patternId
 * @desc    Remove pattern from project
 * @access  Private
 */
router.delete('/:id/patterns/:patternId', [
    (0, validator_1.validateUUID)('id'),
    (0, validator_1.validateUUID)('patternId'),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(projectsController.removePatternFromProject));
/**
 * @route   POST /api/projects/:id/tools
 * @desc    Add tool to project
 * @access  Private
 */
router.post('/:id/tools', [
    (0, validator_1.validateUUID)('id'),
    (0, express_validator_1.body)('toolId').notEmpty().isUUID(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(projectsController.addToolToProject));
/**
 * @route   DELETE /api/projects/:id/tools/:toolId
 * @desc    Remove tool from project
 * @access  Private
 */
router.delete('/:id/tools/:toolId', [
    (0, validator_1.validateUUID)('id'),
    (0, validator_1.validateUUID)('toolId'),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(projectsController.removeToolFromProject));
/**
 * Gauge Adjustment Routes
 */
/**
 * @route   POST /api/projects/:projectId/apply-gauge-adjustment
 * @desc    Apply gauge adjustment to project
 * @access  Private
 */
router.post('/:projectId/apply-gauge-adjustment', [
    (0, validator_1.validateUUID)('projectId'),
    (0, express_validator_1.body)('pattern_gauge').isObject().withMessage('Pattern gauge is required'),
    (0, express_validator_1.body)('pattern_gauge.stitches').isNumeric(),
    (0, express_validator_1.body)('pattern_gauge.rows').isNumeric(),
    (0, express_validator_1.body)('pattern_gauge.measurement').optional({ values: 'falsy' }).isNumeric(),
    (0, express_validator_1.body)('actual_gauge').isObject().withMessage('Actual gauge is required'),
    (0, express_validator_1.body)('actual_gauge.stitches').isNumeric(),
    (0, express_validator_1.body)('actual_gauge.rows').isNumeric(),
    (0, express_validator_1.body)('actual_gauge.measurement').optional({ values: 'falsy' }).isNumeric(),
    (0, express_validator_1.body)('adjusted_instructions').isString().withMessage('Adjusted instructions required'),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(gaugeAdjustmentController.applyAdjustment));
/**
 * @route   GET /api/projects/:projectId/gauge-adjustments
 * @desc    Get gauge adjustment history for project
 * @access  Private
 */
router.get('/:projectId/gauge-adjustments', (0, validator_1.validateUUID)('projectId'), (0, errorHandler_1.asyncHandler)(gaugeAdjustmentController.getAdjustmentHistory));
/**
 * @route   DELETE /api/projects/:projectId/gauge-adjustment
 * @desc    Clear gauge adjustment from project
 * @access  Private
 */
router.delete('/:projectId/gauge-adjustment', (0, validator_1.validateUUID)('projectId'), (0, errorHandler_1.asyncHandler)(gaugeAdjustmentController.clearAdjustment));
/**
 * Chart Progress Routes
 */
/**
 * @route   GET /api/projects/:projectId/charts/:chartId/progress
 * @desc    Get chart progress for a project
 * @access  Private
 */
router.get('/:projectId/charts/:chartId/progress', [(0, validator_1.validateUUID)('projectId'), (0, validator_1.validateUUID)('chartId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartProgressController.getProgress));
/**
 * @route   POST /api/projects/:projectId/charts/:chartId/progress
 * @desc    Update chart progress
 * @access  Private
 */
router.post('/:projectId/charts/:chartId/progress', [
    (0, validator_1.validateUUID)('projectId'),
    (0, validator_1.validateUUID)('chartId'),
    (0, express_validator_1.body)('current_row').optional({ values: 'falsy' }).isInt({ min: 0 }),
    (0, express_validator_1.body)('current_column').optional({ values: 'falsy' }).isInt({ min: 0 }),
    (0, express_validator_1.body)('completed_cells').optional({ values: 'null' }).isArray(),
    (0, express_validator_1.body)('completed_rows').optional({ values: 'null' }).isArray(),
    (0, express_validator_1.body)('tracking_enabled').optional({ values: 'falsy' }).isBoolean(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartProgressController.updateProgress));
/**
 * @route   POST /api/projects/:projectId/charts/:chartId/mark-cell
 * @desc    Mark a single cell as complete/incomplete
 * @access  Private
 */
router.post('/:projectId/charts/:chartId/mark-cell', [
    (0, validator_1.validateUUID)('projectId'),
    (0, validator_1.validateUUID)('chartId'),
    (0, express_validator_1.body)('row').isInt({ min: 0 }).withMessage('Row is required'),
    (0, express_validator_1.body)('column').isInt({ min: 0 }).withMessage('Column is required'),
    (0, express_validator_1.body)('completed').isBoolean().withMessage('Completed status is required'),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartProgressController.markCell));
/**
 * @route   POST /api/projects/:projectId/charts/:chartId/mark-row
 * @desc    Mark an entire row as complete
 * @access  Private
 */
router.post('/:projectId/charts/:chartId/mark-row', [
    (0, validator_1.validateUUID)('projectId'),
    (0, validator_1.validateUUID)('chartId'),
    (0, express_validator_1.body)('row').isInt({ min: 0 }).withMessage('Row is required'),
    (0, express_validator_1.body)('completed').isBoolean().withMessage('Completed status is required'),
    (0, express_validator_1.body)('totalColumns').optional({ values: 'falsy' }).isInt({ min: 1 }),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartProgressController.markRow));
/**
 * @route   DELETE /api/projects/:projectId/charts/:chartId/progress
 * @desc    Clear all progress for a chart
 * @access  Private
 */
router.delete('/:projectId/charts/:chartId/progress', [(0, validator_1.validateUUID)('projectId'), (0, validator_1.validateUUID)('chartId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartProgressController.clearProgress));
/**
 * @route   POST /api/projects/:projectId/charts/:chartId/set-direction
 * @desc    Set working direction for a chart
 * @access  Private
 */
router.post('/:projectId/charts/:chartId/set-direction', [
    (0, validator_1.validateUUID)('projectId'),
    (0, validator_1.validateUUID)('chartId'),
    (0, express_validator_1.body)('working_direction').isIn(['flat_knitting', 'in_the_round', 'flat_from_center']),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartProgressController.setDirection));
/**
 * @route   POST /api/projects/:projectId/charts/:chartId/advance-stitch
 * @desc    Advance stitch in working direction
 * @access  Private
 */
router.post('/:projectId/charts/:chartId/advance-stitch', [
    (0, validator_1.validateUUID)('projectId'),
    (0, validator_1.validateUUID)('chartId'),
    (0, express_validator_1.body)('direction').isIn(['forward', 'backward']),
    (0, express_validator_1.body)('chart_width').optional({ values: 'falsy' }).isInt({ min: 1 }),
    (0, express_validator_1.body)('chart_height').optional({ values: 'falsy' }).isInt({ min: 1 }),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartProgressController.advanceStitch));
/**
 * @route   POST /api/projects/:projectId/charts/:chartId/toggle-direction
 * @desc    Toggle direction for current row
 * @access  Private
 */
router.post('/:projectId/charts/:chartId/toggle-direction', [(0, validator_1.validateUUID)('projectId'), (0, validator_1.validateUUID)('chartId')], validator_1.validate, (0, errorHandler_1.asyncHandler)(chartProgressController.toggleDirection));
/**
 * Magic Markers Analytics Routes
 */
/**
 * @route   POST /api/projects/:projectId/analyze-markers
 * @desc    Analyze pattern and suggest markers
 * @access  Private
 */
router.post('/:projectId/analyze-markers', (0, validator_1.validateUUID)('projectId'), (0, errorHandler_1.asyncHandler)(markerAnalyticsController.analyzeMarkersForProject));
/**
 * @route   POST /api/projects/:projectId/accept-marker-suggestion
 * @desc    Accept an AI-suggested marker
 * @access  Private
 */
router.post('/:projectId/accept-marker-suggestion', [
    (0, validator_1.validateUUID)('projectId'),
    (0, express_validator_1.body)('suggestion').isObject().withMessage('Suggestion is required'),
    (0, express_validator_1.body)('suggestion.name').isString(),
    (0, express_validator_1.body)('suggestion.start_row').isInt({ min: 1 }),
    (0, express_validator_1.body)('suggestion.type').isIn(['counter_value', 'row_range', 'row_interval']),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(markerAnalyticsController.acceptMarkerSuggestion));
/**
 * @route   GET /api/projects/:projectId/marker-timeline
 * @desc    Get marker timeline for visualization
 * @access  Private
 */
router.get('/:projectId/marker-timeline', (0, validator_1.validateUUID)('projectId'), (0, errorHandler_1.asyncHandler)(markerAnalyticsController.getMarkerTimeline));
/**
 * @route   GET /api/projects/:projectId/marker-analytics
 * @desc    Get marker analytics
 * @access  Private
 */
router.get('/:projectId/marker-analytics', (0, validator_1.validateUUID)('projectId'), (0, errorHandler_1.asyncHandler)(markerAnalyticsController.getMarkerAnalytics));
/**
 * @route   GET /api/projects/:projectId/upcoming-markers
 * @desc    Get upcoming markers within N rows
 * @access  Private
 */
router.get('/:projectId/upcoming-markers', (0, validator_1.validateUUID)('projectId'), (0, errorHandler_1.asyncHandler)(markerAnalyticsController.getUpcomingMarkers));
exports.default = router;
