import { Router } from 'express';
import { body } from 'express-validator';
import * as projectsController from '../controllers/projectsController';
import * as gaugeAdjustmentController from '../controllers/gaugeAdjustmentController';
import * as chartProgressController from '../controllers/chartProgressController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID, validatePagination, validateSearch } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/projects
 * @desc    Get all projects for current user
 * @access  Private
 */
router.get(
  '/',
  validatePagination,
  validateSearch,
  asyncHandler(projectsController.getProjects)
);

/**
 * @route   GET /api/projects/stats
 * @desc    Get project statistics
 * @access  Private
 */
router.get('/stats', asyncHandler(projectsController.getProjectStats));

/**
 * @route   GET /api/projects/:id
 * @desc    Get single project by ID
 * @access  Private
 */
router.get(
  '/:id',
  validateUUID('id'),
  asyncHandler(projectsController.getProject)
);

/**
 * @route   POST /api/projects
 * @desc    Create new project
 * @access  Private
 */
router.post(
  '/',
  [
    body('name').trim().notEmpty().isLength({ max: 255 }),
    body('description').optional().trim(),
    body('projectType').optional().trim(),
    body('startDate').optional().isISO8601(),
    body('targetCompletionDate').optional().isISO8601(),
  ],
  validate,
  asyncHandler(projectsController.createProject)
);

/**
 * @route   PUT /api/projects/:id
 * @desc    Update project
 * @access  Private
 */
router.put(
  '/:id',
  validateUUID('id'),
  asyncHandler(projectsController.updateProject)
);

/**
 * @route   DELETE /api/projects/:id
 * @desc    Delete project
 * @access  Private
 */
router.delete(
  '/:id',
  validateUUID('id'),
  asyncHandler(projectsController.deleteProject)
);

/**
 * @route   POST /api/projects/:id/yarn
 * @desc    Add yarn to project with automatic stash deduction
 * @access  Private
 */
router.post(
  '/:id/yarn',
  [
    validateUUID('id'),
    body('yarnId').notEmpty().isUUID(),
    body('yardsUsed').optional().isNumeric(),
    body('skeinsUsed').optional().isNumeric(),
  ],
  validate,
  asyncHandler(projectsController.addYarnToProject)
);

/**
 * @route   PUT /api/projects/:id/yarn/:yarnId
 * @desc    Update yarn usage in project with automatic stash adjustment
 * @access  Private
 */
router.put(
  '/:id/yarn/:yarnId',
  [
    validateUUID('id'),
    validateUUID('yarnId'),
    body('yardsUsed').optional().isNumeric(),
    body('skeinsUsed').optional().isNumeric(),
  ],
  validate,
  asyncHandler(projectsController.updateProjectYarn)
);

/**
 * @route   DELETE /api/projects/:id/yarn/:yarnId
 * @desc    Remove yarn from project with stash restoration
 * @access  Private
 */
router.delete(
  '/:id/yarn/:yarnId',
  [
    validateUUID('id'),
    validateUUID('yarnId'),
  ],
  validate,
  asyncHandler(projectsController.removeYarnFromProject)
);

/**
 * @route   POST /api/projects/:id/patterns
 * @desc    Add pattern to project
 * @access  Private
 */
router.post(
  '/:id/patterns',
  [
    validateUUID('id'),
    body('patternId').notEmpty().isUUID(),
    body('modifications').optional().isString(),
  ],
  validate,
  asyncHandler(projectsController.addPatternToProject)
);

/**
 * @route   DELETE /api/projects/:id/patterns/:patternId
 * @desc    Remove pattern from project
 * @access  Private
 */
router.delete(
  '/:id/patterns/:patternId',
  [
    validateUUID('id'),
    validateUUID('patternId'),
  ],
  validate,
  asyncHandler(projectsController.removePatternFromProject)
);

/**
 * @route   POST /api/projects/:id/tools
 * @desc    Add tool to project
 * @access  Private
 */
router.post(
  '/:id/tools',
  [
    validateUUID('id'),
    body('toolId').notEmpty().isUUID(),
  ],
  validate,
  asyncHandler(projectsController.addToolToProject)
);

/**
 * @route   DELETE /api/projects/:id/tools/:toolId
 * @desc    Remove tool from project
 * @access  Private
 */
router.delete(
  '/:id/tools/:toolId',
  [
    validateUUID('id'),
    validateUUID('toolId'),
  ],
  validate,
  asyncHandler(projectsController.removeToolFromProject)
);

/**
 * Gauge Adjustment Routes
 */

/**
 * @route   POST /api/projects/:projectId/apply-gauge-adjustment
 * @desc    Apply gauge adjustment to project
 * @access  Private
 */
router.post(
  '/:projectId/apply-gauge-adjustment',
  [
    validateUUID('projectId'),
    body('pattern_gauge').isObject().withMessage('Pattern gauge is required'),
    body('pattern_gauge.stitches').isNumeric(),
    body('pattern_gauge.rows').isNumeric(),
    body('pattern_gauge.measurement').optional().isNumeric(),
    body('actual_gauge').isObject().withMessage('Actual gauge is required'),
    body('actual_gauge.stitches').isNumeric(),
    body('actual_gauge.rows').isNumeric(),
    body('actual_gauge.measurement').optional().isNumeric(),
    body('adjusted_instructions').isString().withMessage('Adjusted instructions required'),
  ],
  validate,
  asyncHandler(gaugeAdjustmentController.applyAdjustment)
);

/**
 * @route   GET /api/projects/:projectId/gauge-adjustments
 * @desc    Get gauge adjustment history for project
 * @access  Private
 */
router.get(
  '/:projectId/gauge-adjustments',
  validateUUID('projectId'),
  asyncHandler(gaugeAdjustmentController.getAdjustmentHistory)
);

/**
 * @route   DELETE /api/projects/:projectId/gauge-adjustment
 * @desc    Clear gauge adjustment from project
 * @access  Private
 */
router.delete(
  '/:projectId/gauge-adjustment',
  validateUUID('projectId'),
  asyncHandler(gaugeAdjustmentController.clearAdjustment)
);

/**
 * Chart Progress Routes
 */

/**
 * @route   GET /api/projects/:projectId/charts/:chartId/progress
 * @desc    Get chart progress for a project
 * @access  Private
 */
router.get(
  '/:projectId/charts/:chartId/progress',
  [validateUUID('projectId'), validateUUID('chartId')],
  validate,
  asyncHandler(chartProgressController.getProgress)
);

/**
 * @route   POST /api/projects/:projectId/charts/:chartId/progress
 * @desc    Update chart progress
 * @access  Private
 */
router.post(
  '/:projectId/charts/:chartId/progress',
  [
    validateUUID('projectId'),
    validateUUID('chartId'),
    body('current_row').optional().isInt({ min: 0 }),
    body('current_column').optional().isInt({ min: 0 }),
    body('completed_cells').optional().isArray(),
    body('completed_rows').optional().isArray(),
    body('tracking_enabled').optional().isBoolean(),
  ],
  validate,
  asyncHandler(chartProgressController.updateProgress)
);

/**
 * @route   POST /api/projects/:projectId/charts/:chartId/mark-cell
 * @desc    Mark a single cell as complete/incomplete
 * @access  Private
 */
router.post(
  '/:projectId/charts/:chartId/mark-cell',
  [
    validateUUID('projectId'),
    validateUUID('chartId'),
    body('row').isInt({ min: 0 }).withMessage('Row is required'),
    body('column').isInt({ min: 0 }).withMessage('Column is required'),
    body('completed').isBoolean().withMessage('Completed status is required'),
  ],
  validate,
  asyncHandler(chartProgressController.markCell)
);

/**
 * @route   POST /api/projects/:projectId/charts/:chartId/mark-row
 * @desc    Mark an entire row as complete
 * @access  Private
 */
router.post(
  '/:projectId/charts/:chartId/mark-row',
  [
    validateUUID('projectId'),
    validateUUID('chartId'),
    body('row').isInt({ min: 0 }).withMessage('Row is required'),
    body('completed').isBoolean().withMessage('Completed status is required'),
    body('totalColumns').optional().isInt({ min: 1 }),
  ],
  validate,
  asyncHandler(chartProgressController.markRow)
);

/**
 * @route   DELETE /api/projects/:projectId/charts/:chartId/progress
 * @desc    Clear all progress for a chart
 * @access  Private
 */
router.delete(
  '/:projectId/charts/:chartId/progress',
  [validateUUID('projectId'), validateUUID('chartId')],
  validate,
  asyncHandler(chartProgressController.clearProgress)
);

export default router;
