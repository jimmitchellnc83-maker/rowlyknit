import { Router } from 'express';
import { body } from 'express-validator';
import * as projectsController from '../controllers/projectsController';
import * as projectSharingController from '../controllers/projectSharingController';
import * as gaugeAdjustmentController from '../controllers/gaugeAdjustmentController';
import * as chartProgressController from '../controllers/chartProgressController';
import * as markerAnalyticsController from '../controllers/markerAnalyticsController';
import * as sourceFilesController from '../controllers/sourceFilesController';
import * as markerStateController from '../controllers/markerStateController';
import * as joinLayoutController from '../controllers/joinLayoutController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID, validatePagination, validateSearch } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/projects/types
 * @desc    Get allowed project types
 * @access  Private
 */
router.get('/types', asyncHandler(projectsController.getProjectTypes));

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
 * @route   GET /api/projects/feasibility-summary
 * @desc    Per-project overall feasibility verdict for the Projects list badge
 * @access  Private
 */
router.get(
  '/feasibility-summary',
  asyncHandler(projectsController.getProjectsFeasibilitySummary),
);

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
    body('startDate').optional({ values: 'falsy' }).isISO8601(),
    body('targetCompletionDate').optional({ values: 'falsy' }).isISO8601(),
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
  [
    validateUUID('id'),
    body('name').optional().trim().isLength({ max: 255 }),
    body('description').optional({ values: 'null' }).isString(),
    body('projectType').optional({ values: 'falsy' }).trim().isLength({ max: 100 }),
    body('startDate').optional({ values: 'falsy' }).isISO8601(),
    body('targetCompletionDate').optional({ values: 'falsy' }).isISO8601(),
    body('completedDate').optional({ values: 'falsy' }).isISO8601(),
    body('status').optional({ values: 'falsy' }).isString().isLength({ max: 50 }),
    body('notes').optional({ values: 'null' }).isString(),
    body('metadata').optional({ values: 'null' }).isObject(),
    body('tags').optional({ values: 'null' }).isArray(),
    body('isFavorite').optional().isBoolean(),
  ],
  validate,
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
 * @route   POST /api/projects/:id/duplicate
 * @desc    Duplicate a project ("make this again") — new project starts
 *          fresh (no yarn, photos, notes, sessions); structure carries over.
 * @access  Private
 */
router.post(
  '/:id/duplicate',
  [
    validateUUID('id'),
    body('newName').optional({ values: 'null' }).isString().isLength({ min: 1, max: 255 }),
  ],
  validate,
  asyncHandler(projectsController.duplicateProject)
);

/**
 * @route   PATCH /api/projects/:id/visibility
 * @desc    Toggle whether a project is publicly viewable; generates a
 *          stable share slug on first publish.
 * @access  Private
 */
router.patch(
  '/:id/visibility',
  [validateUUID('id'), body('isPublic').isBoolean()],
  validate,
  asyncHandler(projectSharingController.updateProjectVisibility)
);

/**
 * @route   PATCH /api/projects/:projectId/patterns/:patternId/source-file
 * @desc    Pin a Wave 2 source file to a project_patterns linkage
 * @access  Private
 */
router.patch(
  '/:projectId/patterns/:patternId/source-file',
  [
    validateUUID('projectId'),
    validateUUID('patternId'),
    // Accept null OR a string (UUID validation happens server-side).
    body('sourceFileId').custom((v) => v === null || typeof v === 'string'),
  ],
  validate,
  asyncHandler(sourceFilesController.pinSourceFile)
);

/**
 * @route   GET /api/projects/:id/marker-history
 * @desc    Wave 4 — recent marker-state moves across counter/panel/chart
 * @access  Private
 */
router.get(
  '/:id/marker-history',
  validateUUID('id'),
  asyncHandler(markerStateController.listMarkerHistoryHandler)
);

/**
 * @route   POST /api/projects/:id/marker-history/:entryId/rewind
 * @desc    Wave 4 — apply a history snapshot, log the rewind
 * @access  Private
 */
router.post(
  '/:id/marker-history/:entryId/rewind',
  [validateUUID('id'), validateUUID('entryId')],
  validate,
  asyncHandler(markerStateController.rewindMarkerHistoryHandler)
);

// =========================
// Wave 6 — Join layouts
// =========================
router.post(
  '/:id/join-layouts',
  [
    validateUUID('id'),
    body('name').isString().isLength({ min: 1, max: 120 }),
    body('regions').optional().isArray(),
  ],
  validate,
  asyncHandler(joinLayoutController.createJoinLayoutHandler)
);
router.get(
  '/:id/join-layouts',
  validateUUID('id'),
  asyncHandler(joinLayoutController.listJoinLayoutsHandler)
);
router.patch(
  '/:id/join-layouts/:layoutId',
  [
    validateUUID('id'),
    validateUUID('layoutId'),
    body('name').optional().isString().isLength({ min: 1, max: 120 }),
    body('regions').optional().isArray(),
  ],
  validate,
  asyncHandler(joinLayoutController.updateJoinLayoutHandler)
);
router.delete(
  '/:id/join-layouts/:layoutId',
  [validateUUID('id'), validateUUID('layoutId')],
  validate,
  asyncHandler(joinLayoutController.deleteJoinLayoutHandler)
);

// =========================
// Wave 6 — Blank pages
// =========================
router.post(
  '/:id/blank-pages',
  [
    validateUUID('id'),
    body('width').isFloat({ gt: 0 }),
    body('height').isFloat({ gt: 0 }),
    body('aspectKind').optional().isIn(['letter', 'a4', 'square', 'custom']),
    body('craft').optional().isIn(['knit', 'crochet']),
    body('name').optional({ values: 'null' }).isString().isLength({ max: 120 }),
  ],
  validate,
  asyncHandler(joinLayoutController.createBlankPageHandler)
);
router.get(
  '/:id/blank-pages',
  validateUUID('id'),
  asyncHandler(joinLayoutController.listBlankPagesHandler)
);
router.patch(
  '/:id/blank-pages/:pageId',
  [
    validateUUID('id'),
    validateUUID('pageId'),
    body('name').optional({ values: 'null' }).isString().isLength({ max: 120 }),
    body('strokes').optional().isArray(),
  ],
  validate,
  asyncHandler(joinLayoutController.updateBlankPageHandler)
);
router.delete(
  '/:id/blank-pages/:pageId',
  [validateUUID('id'), validateUUID('pageId')],
  validate,
  asyncHandler(joinLayoutController.deleteBlankPageHandler)
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
    // `min: 0` rejects negatives at the validator boundary. A negative
    // `yardsUsed` would otherwise survive `isNumeric` and reach the
    // stash-adjust transaction in `addYarnToProject` — where the diff
    // arithmetic happily credits the user's stash for a value that was
    // never knit. Defense in depth lives in the controller too.
    body('yardsUsed').optional({ values: 'falsy' }).isFloat({ min: 0 }),
    body('skeinsUsed').optional({ values: 'falsy' }).isFloat({ min: 0 }),
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
    // Same `min: 0` reasoning as the POST above. The update path is
    // worse if it slips: the diff `yardsUsed - projectYarn.yards_used`
    // goes negative and the stash UPDATE adds yards back, inflating
    // the available count beyond what the row was ever bought with.
    body('yardsUsed').optional({ values: 'falsy' }).isFloat({ min: 0 }),
    body('skeinsUsed').optional({ values: 'falsy' }).isFloat({ min: 0 }),
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
 * @desc    Add pattern to project. Body must contain exactly one of
 *          `patternId` (legacy `patterns.id`) or `patternModelId`
 *          (canonical `pattern_models.id`). The controller resolves
 *          canonical ids through `materializeLegacyStubForCanonical`.
 *          Both-set or neither-set is rejected at the validator before
 *          the controller runs.
 * @access  Private
 */
router.post(
  '/:id/patterns',
  [
    validateUUID('id'),
    body('patternId')
      .optional({ values: 'null' })
      .isUUID()
      .withMessage('patternId must be a UUID'),
    body('patternModelId')
      .optional({ values: 'null' })
      .isUUID()
      .withMessage('patternModelId must be a UUID'),
    body('modifications').optional({ values: 'null' }).isString(),
    body().custom((value) => {
      const has = (k: string) =>
        value &&
        typeof value === 'object' &&
        value[k] !== undefined &&
        value[k] !== null &&
        value[k] !== '';
      const hasLegacy = has('patternId');
      const hasCanonical = has('patternModelId');
      if (!hasLegacy && !hasCanonical) {
        throw new Error('Either patternId or patternModelId is required');
      }
      if (hasLegacy && hasCanonical) {
        throw new Error('Provide only one of patternId or patternModelId, not both');
      }
      return true;
    }),
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
    body('pattern_gauge.measurement').optional({ values: 'falsy' }).isNumeric(),
    body('actual_gauge').isObject().withMessage('Actual gauge is required'),
    body('actual_gauge.stitches').isNumeric(),
    body('actual_gauge.rows').isNumeric(),
    body('actual_gauge.measurement').optional({ values: 'falsy' }).isNumeric(),
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
    body('current_row').optional({ values: 'falsy' }).isInt({ min: 0 }),
    body('current_column').optional({ values: 'falsy' }).isInt({ min: 0 }),
    body('completed_cells').optional({ values: 'null' }).isArray(),
    body('completed_rows').optional({ values: 'null' }).isArray(),
    body('tracking_enabled').optional({ values: 'falsy' }).isBoolean(),
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
    body('totalColumns').optional({ values: 'falsy' }).isInt({ min: 1 }),
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

/**
 * @route   POST /api/projects/:projectId/charts/:chartId/set-direction
 * @desc    Set working direction for a chart
 * @access  Private
 */
router.post(
  '/:projectId/charts/:chartId/set-direction',
  [
    validateUUID('projectId'),
    validateUUID('chartId'),
    body('working_direction').isIn(['flat_knitting', 'in_the_round', 'flat_from_center']),
  ],
  validate,
  asyncHandler(chartProgressController.setDirection)
);

/**
 * @route   POST /api/projects/:projectId/charts/:chartId/advance-stitch
 * @desc    Advance stitch in working direction
 * @access  Private
 */
router.post(
  '/:projectId/charts/:chartId/advance-stitch',
  [
    validateUUID('projectId'),
    validateUUID('chartId'),
    body('direction').isIn(['forward', 'backward']),
    body('chart_width').optional({ values: 'falsy' }).isInt({ min: 1 }),
    body('chart_height').optional({ values: 'falsy' }).isInt({ min: 1 }),
  ],
  validate,
  asyncHandler(chartProgressController.advanceStitch)
);

/**
 * @route   POST /api/projects/:projectId/charts/:chartId/toggle-direction
 * @desc    Toggle direction for current row
 * @access  Private
 */
router.post(
  '/:projectId/charts/:chartId/toggle-direction',
  [validateUUID('projectId'), validateUUID('chartId')],
  validate,
  asyncHandler(chartProgressController.toggleDirection)
);

/**
 * Magic Markers Analytics Routes
 */

/**
 * @route   POST /api/projects/:projectId/analyze-markers
 * @desc    Analyze pattern and suggest markers
 * @access  Private
 */
router.post(
  '/:projectId/analyze-markers',
  validateUUID('projectId'),
  asyncHandler(markerAnalyticsController.analyzeMarkersForProject)
);

/**
 * @route   POST /api/projects/:projectId/accept-marker-suggestion
 * @desc    Accept an AI-suggested marker
 * @access  Private
 */
router.post(
  '/:projectId/accept-marker-suggestion',
  [
    validateUUID('projectId'),
    body('suggestion').isObject().withMessage('Suggestion is required'),
    body('suggestion.name').isString(),
    body('suggestion.start_row').isInt({ min: 1 }),
    body('suggestion.type').isIn(['counter_value', 'row_range', 'row_interval']),
  ],
  validate,
  asyncHandler(markerAnalyticsController.acceptMarkerSuggestion)
);

/**
 * @route   GET /api/projects/:projectId/marker-timeline
 * @desc    Get marker timeline for visualization
 * @access  Private
 */
router.get(
  '/:projectId/marker-timeline',
  validateUUID('projectId'),
  asyncHandler(markerAnalyticsController.getMarkerTimeline)
);

/**
 * @route   GET /api/projects/:projectId/marker-analytics
 * @desc    Get marker analytics
 * @access  Private
 */
router.get(
  '/:projectId/marker-analytics',
  validateUUID('projectId'),
  asyncHandler(markerAnalyticsController.getMarkerAnalytics)
);

/**
 * @route   GET /api/projects/:projectId/upcoming-markers
 * @desc    Get upcoming markers within N rows
 * @access  Private
 */
router.get(
  '/:projectId/upcoming-markers',
  validateUUID('projectId'),
  asyncHandler(markerAnalyticsController.getUpcomingMarkers)
);

export default router;
