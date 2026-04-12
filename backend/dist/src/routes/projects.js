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
const auth_1 = require("../middleware/auth");
const validator_1 = require("../middleware/validator");
const errorHandler_1 = require("../utils/errorHandler");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_1.authenticate);
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
    (0, express_validator_1.body)('startDate').optional().isISO8601(),
    (0, express_validator_1.body)('targetCompletionDate').optional().isISO8601(),
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
    (0, express_validator_1.body)('yardsUsed').optional().isNumeric(),
    (0, express_validator_1.body)('skeinsUsed').optional().isNumeric(),
], validator_1.validate, (0, errorHandler_1.asyncHandler)(projectsController.addYarnToProject));
/**
 * @route   PUT /api/projects/:id/yarn/:yarnId
 * @desc    Update yarn usage in project with automatic stash adjustment
 * @access  Private
 */
router.put('/:id/yarn/:yarnId', [
    (0, validator_1.validateUUID)('id'),
    (0, validator_1.validateUUID)('yarnId'),
    (0, express_validator_1.body)('yardsUsed').optional().isNumeric(),
    (0, express_validator_1.body)('skeinsUsed').optional().isNumeric(),
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
    (0, express_validator_1.body)('modifications').optional().isString(),
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
exports.default = router;
