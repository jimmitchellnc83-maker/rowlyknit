import { Router } from 'express';
import { body } from 'express-validator';
import * as chartsController from '../controllers/chartsController';
import { authenticate } from '../middleware/auth';
import { validate, validateUUID } from '../middleware/validator';
import { asyncHandler } from '../utils/errorHandler';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/patterns/:patternId/charts
 * @desc    Get all charts for a pattern
 * @access  Private
 */
router.get(
  '/patterns/:patternId/charts',
  validateUUID('patternId'),
  asyncHandler(chartsController.getCharts)
);

/**
 * @route   GET /api/patterns/:patternId/charts/:chartId
 * @desc    Get a single chart with cells and symbols
 * @access  Private
 */
router.get(
  '/patterns/:patternId/charts/:chartId',
  [validateUUID('patternId'), validateUUID('chartId')],
  validate,
  asyncHandler(chartsController.getChart)
);

/**
 * @route   POST /api/patterns/:patternId/charts
 * @desc    Create a new chart
 * @access  Private
 */
router.post(
  '/patterns/:patternId/charts',
  [
    validateUUID('patternId'),
    body('title').trim().notEmpty().isLength({ max: 255 }),
    body('rows').isInt({ min: 1, max: 1000 }),
    body('cols').isInt({ min: 1, max: 1000 }),
    body('isInTheRound').optional().isBoolean(),
    body('notes').optional().isString(),
    body('chartData').optional().isArray(),
    body('symbolIds').optional().isArray(),
  ],
  validate,
  asyncHandler(chartsController.createChart)
);

/**
 * @route   PUT /api/patterns/:patternId/charts/:chartId
 * @desc    Update a chart
 * @access  Private
 */
router.put(
  '/patterns/:patternId/charts/:chartId',
  [
    validateUUID('patternId'),
    validateUUID('chartId'),
    body('title').optional().trim().notEmpty().isLength({ max: 255 }),
    body('rows').optional().isInt({ min: 1, max: 1000 }),
    body('cols').optional().isInt({ min: 1, max: 1000 }),
    body('isInTheRound').optional().isBoolean(),
    body('notes').optional().isString(),
    body('chartData').optional().isArray(),
    body('symbolIds').optional().isArray(),
  ],
  validate,
  asyncHandler(chartsController.updateChart)
);

/**
 * @route   DELETE /api/patterns/:patternId/charts/:chartId
 * @desc    Delete a chart
 * @access  Private
 */
router.delete(
  '/patterns/:patternId/charts/:chartId',
  [validateUUID('patternId'), validateUUID('chartId')],
  validate,
  asyncHandler(chartsController.deleteChart)
);

/**
 * @route   PATCH /api/patterns/:patternId/charts/reorder
 * @desc    Reorder charts
 * @access  Private
 */
router.patch(
  '/patterns/:patternId/charts/reorder',
  [validateUUID('patternId'), body('charts').isArray()],
  validate,
  asyncHandler(chartsController.reorderCharts)
);

/**
 * @route   GET /api/chart-symbols
 * @desc    Get all available chart symbols
 * @access  Private
 */
router.get(
  '/chart-symbols',
  asyncHandler(chartsController.getSymbols)
);

/**
 * @route   POST /api/chart-symbols
 * @desc    Create a custom symbol
 * @access  Private
 */
router.post(
  '/chart-symbols',
  [
    body('symbol').trim().notEmpty().isLength({ max: 10 }),
    body('name').trim().notEmpty().isLength({ max: 100 }),
    body('description').trim().notEmpty(),
    body('color').optional().isString().isLength({ min: 7, max: 7 }),
    body('category').optional().isString().isLength({ max: 50 }),
  ],
  validate,
  asyncHandler(chartsController.createSymbol)
);

export default router;
