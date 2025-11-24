import { Request, Response } from 'express';
import patternExportService from '../services/patternExportService';
import db from '../config/database';
import logger from '../config/logger';

/**
 * Export pattern to PDF with yarn requirements
 * POST /api/patterns/:id/export
 */
export async function exportPattern(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: patternId } = req.params;
  const {
    projectId,
    includeYarnRequirements = true,
    includeSizeAdjustments = true,
    includeNotes = true,
    includeGauge = true,
    selectedSize,
    lengthAdjustment,
    widthAdjustment,
    adjustmentUnit = 'inches',
  } = req.body;

  try {
    const result = await patternExportService.generateExportPDF(userId, patternId, projectId, {
      includeYarnRequirements,
      includeSizeAdjustments,
      includeNotes,
      includeGauge,
      selectedSize,
      lengthAdjustment: lengthAdjustment ? parseFloat(lengthAdjustment) : undefined,
      widthAdjustment: widthAdjustment ? parseFloat(widthAdjustment) : undefined,
      adjustmentUnit,
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        fileUrl: result.fileUrl,
        filePath: result.filePath,
        fileSize: result.fileSize,
      },
    });
  } catch (error) {
    logger.error('Error in exportPattern controller', {
      userId,
      patternId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to export pattern',
    });
  }
}

/**
 * Calculate adjusted yarn requirements without generating PDF
 * POST /api/patterns/:id/calculate-yarn
 */
export async function calculateYarn(req: Request, res: Response): Promise<void> {
  const userId = req.user!.userId;
  const { id: patternId } = req.params;
  const {
    baseYardage,
    lengthAdjustment,
    widthAdjustment,
    adjustmentUnit = 'inches',
  } = req.body;

  try {
    // Fetch pattern to get default yardage if not provided
    const pattern = await db('patterns')
      .where({ id: patternId, user_id: userId })
      .whereNull('deleted_at')
      .first();

    if (!pattern) {
      res.status(404).json({
        success: false,
        error: 'Pattern not found',
      });
      return;
    }

    // Use provided base yardage or pattern's estimated yardage
    let yardageToCalculate = baseYardage;
    if (!yardageToCalculate) {
      // Try to get from yarn_requirements first
      const yarnReqs = pattern.yarn_requirements
        ? (typeof pattern.yarn_requirements === 'string'
            ? JSON.parse(pattern.yarn_requirements)
            : pattern.yarn_requirements)
        : [];

      if (yarnReqs.length > 0 && yarnReqs[0].yardage) {
        yardageToCalculate = yarnReqs[0].yardage;
      } else {
        yardageToCalculate = pattern.estimated_yardage || 0;
      }
    }

    if (!yardageToCalculate || yardageToCalculate <= 0) {
      res.status(400).json({
        success: false,
        error: 'No yardage data available for this pattern',
      });
      return;
    }

    // Convert length/width adjustments to percentages
    const lengthPercent = lengthAdjustment
      ? patternExportService.lengthToPercentage(parseFloat(lengthAdjustment), adjustmentUnit)
      : 0;
    const widthPercent = widthAdjustment
      ? patternExportService.widthToPercentage(parseFloat(widthAdjustment), adjustmentUnit)
      : 0;

    // Calculate adjusted yarn
    const calculation = patternExportService.calculateYarnRequirements(
      yardageToCalculate,
      lengthPercent,
      widthPercent
    );

    res.status(200).json({
      success: true,
      data: {
        baseYardage: calculation.baseYardage,
        adjustedYardage: calculation.adjustedYardage,
        percentageIncrease: calculation.percentageIncrease,
        lengthAdjustmentPercent: lengthPercent,
        widthAdjustmentPercent: widthPercent,
        adjustments: {
          length: lengthAdjustment ? parseFloat(lengthAdjustment) : 0,
          width: widthAdjustment ? parseFloat(widthAdjustment) : 0,
          unit: adjustmentUnit,
        },
      },
    });
  } catch (error) {
    logger.error('Error in calculateYarn controller', {
      userId,
      patternId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({
      success: false,
      error: 'Failed to calculate yarn requirements',
    });
  }
}
