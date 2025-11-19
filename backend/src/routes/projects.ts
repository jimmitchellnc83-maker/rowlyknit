import { Router } from 'express';
import { body } from 'express-validator';
import * as projectsController from '../controllers/projectsController';
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

export default router;
