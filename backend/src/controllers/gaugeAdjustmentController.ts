import { Request, Response } from 'express';
import gaugeAdjustmentService from '../services/gaugeAdjustmentService';
import logger from '../config/logger';

/**
 * Calculate gauge adjustment for a pattern
 * POST /api/patterns/:patternId/calculate-adjustment
 */
export async function calculateAdjustment(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { patternId } = req.params;
  const { pattern_gauge, actual_gauge } = req.body;

  try {
    // Validate gauge data
    if (!pattern_gauge || !actual_gauge) {
      res.status(400).json({
        success: false,
        error: 'Both pattern gauge and actual gauge are required',
      });
      return;
    }

    // Validate gauge values are positive
    if (
      pattern_gauge.stitches <= 0 ||
      pattern_gauge.rows <= 0 ||
      actual_gauge.stitches <= 0 ||
      actual_gauge.rows <= 0
    ) {
      res.status(400).json({
        success: false,
        error: 'Gauge values must be positive numbers',
      });
      return;
    }

    const result = await gaugeAdjustmentService.calculateAdjustment(
      patternId,
      pattern_gauge,
      actual_gauge
    );

    // Warn if gauge difference is very large
    const warning =
      Math.abs(result.comparison.stitch_difference_percent) > 30 ||
      Math.abs(result.comparison.row_difference_percent) > 30
        ? 'Large gauge difference detected. Results may require manual review.'
        : undefined;

    res.status(200).json({
      success: true,
      data: {
        comparison: result.comparison,
        original_instructions: result.original_instructions,
        adjusted_instructions: result.adjusted_instructions,
        changes: result.changes,
        comparison_view: gaugeAdjustmentService.generateComparisonView(
          result.original_instructions,
          result.adjusted_instructions
        ),
        warning,
      },
    });
  } catch (error) {
    logger.error('Error calculating gauge adjustment', {
      userId,
      patternId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to calculate gauge adjustment',
    });
  }
}

/**
 * Apply gauge adjustment to a project
 * POST /api/projects/:projectId/apply-gauge-adjustment
 */
export async function applyAdjustment(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { projectId } = req.params;
  const { pattern_gauge, actual_gauge, adjusted_instructions, original_instructions } = req.body;

  try {
    // Validate required fields
    if (!pattern_gauge || !actual_gauge || !adjusted_instructions) {
      res.status(400).json({
        success: false,
        error: 'Pattern gauge, actual gauge, and adjusted instructions are required',
      });
      return;
    }

    const project = await gaugeAdjustmentService.applyAdjustment(
      projectId,
      userId,
      pattern_gauge,
      actual_gauge,
      adjusted_instructions,
      original_instructions || ''
    );

    if (!project) {
      res.status(404).json({
        success: false,
        error: 'Project not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Gauge adjustment applied successfully',
      data: { project },
    });
  } catch (error) {
    logger.error('Error applying gauge adjustment', {
      userId,
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to apply gauge adjustment',
    });
  }
}

/**
 * Get gauge adjustment history for a project
 * GET /api/projects/:projectId/gauge-adjustments
 */
export async function getAdjustmentHistory(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { projectId } = req.params;

  try {
    const history = await gaugeAdjustmentService.getAdjustmentHistory(projectId, userId);

    res.status(200).json({
      success: true,
      data: { adjustments: history },
    });
  } catch (error) {
    logger.error('Error fetching adjustment history', {
      userId,
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof Error && error.message === 'Project not found') {
      res.status(404).json({
        success: false,
        error: 'Project not found',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Failed to fetch adjustment history',
    });
  }
}

/**
 * Clear gauge adjustment from project
 * DELETE /api/projects/:projectId/gauge-adjustment
 */
export async function clearAdjustment(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { projectId } = req.params;

  try {
    const project = await gaugeAdjustmentService.clearAdjustment(projectId, userId);

    if (!project) {
      res.status(404).json({
        success: false,
        error: 'Project not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Gauge adjustment cleared',
      data: { project },
    });
  } catch (error) {
    logger.error('Error clearing gauge adjustment', {
      userId,
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to clear gauge adjustment',
    });
  }
}

/**
 * Compare gauges without pattern (quick calculation)
 * POST /api/gauge/compare
 */
export async function compareGauges(req: Request, res: Response): Promise<void> {
  const { pattern_gauge, actual_gauge } = req.body;

  try {
    if (!pattern_gauge || !actual_gauge) {
      res.status(400).json({
        success: false,
        error: 'Both pattern gauge and actual gauge are required',
      });
      return;
    }

    const comparison = gaugeAdjustmentService.compareGauge(pattern_gauge, actual_gauge);

    res.status(200).json({
      success: true,
      data: { comparison },
    });
  } catch (error) {
    logger.error('Error comparing gauges', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to compare gauges',
    });
  }
}
