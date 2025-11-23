"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportPattern = exportPattern;
exports.calculateYarn = calculateYarn;
const patternExportService_1 = __importDefault(require("../services/patternExportService"));
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
/**
 * Export pattern to PDF with yarn requirements
 * POST /api/patterns/:id/export
 */
async function exportPattern(req, res) {
    const userId = req.user.userId;
    const { id: patternId } = req.params;
    const { projectId, includeYarnRequirements = true, includeSizeAdjustments = true, includeNotes = true, includeGauge = true, selectedSize, lengthAdjustment, widthAdjustment, adjustmentUnit = 'inches', } = req.body;
    try {
        const result = await patternExportService_1.default.generateExportPDF(userId, patternId, projectId, {
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
    }
    catch (error) {
        logger_1.default.error('Error in exportPattern controller', {
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
async function calculateYarn(req, res) {
    const userId = req.user.userId;
    const { id: patternId } = req.params;
    const { baseYardage, lengthAdjustment, widthAdjustment, adjustmentUnit = 'inches', } = req.body;
    try {
        // Fetch pattern to get default yardage if not provided
        const pattern = await (0, database_1.default)('patterns')
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
            }
            else {
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
            ? patternExportService_1.default.lengthToPercentage(parseFloat(lengthAdjustment), adjustmentUnit)
            : 0;
        const widthPercent = widthAdjustment
            ? patternExportService_1.default.widthToPercentage(parseFloat(widthAdjustment), adjustmentUnit)
            : 0;
        // Calculate adjusted yarn
        const calculation = patternExportService_1.default.calculateYarnRequirements(yardageToCalculate, lengthPercent, widthPercent);
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
    }
    catch (error) {
        logger_1.default.error('Error in calculateYarn controller', {
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
