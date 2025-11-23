"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
class GaugeAdjustmentService {
    /**
     * Compare pattern gauge to actual gauge and calculate multipliers
     */
    compareGauge(patternGauge, actualGauge) {
        // Normalize to same measurement if different
        const normalizedPatternStitches = (patternGauge.stitches / patternGauge.measurement) * 4;
        const normalizedPatternRows = (patternGauge.rows / patternGauge.measurement) * 4;
        const normalizedActualStitches = (actualGauge.stitches / actualGauge.measurement) * 4;
        const normalizedActualRows = (actualGauge.rows / actualGauge.measurement) * 4;
        // Calculate multipliers (pattern/actual because fewer stitches = more needed)
        const stitch_multiplier = normalizedPatternStitches / normalizedActualStitches;
        const row_multiplier = normalizedPatternRows / normalizedActualRows;
        // Calculate percentage differences
        const stitch_difference_percent = Math.round((stitch_multiplier - 1) * 100);
        const row_difference_percent = Math.round((row_multiplier - 1) * 100);
        // Needs adjustment if difference > 5%
        const needs_adjustment = Math.abs(stitch_difference_percent) > 5 || Math.abs(row_difference_percent) > 5;
        return {
            stitch_difference_percent,
            row_difference_percent,
            needs_adjustment,
            stitch_multiplier,
            row_multiplier,
        };
    }
    /**
     * Adjust pattern instructions based on gauge multipliers
     */
    adjustPatternInstructions(instructions, stitchMultiplier, rowMultiplier) {
        let adjusted = instructions;
        const changes = [];
        // Find and replace stitch counts
        // Patterns: "cast on 88 stitches", "88 sts", "k88", "88 st"
        adjusted = adjusted.replace(/(\d+)\s*(stitches?|sts?|st\b)/gi, (match, num, suffix) => {
            const original = parseInt(num, 10);
            const adjustedNum = Math.round(original * stitchMultiplier);
            if (original !== adjustedNum) {
                changes.push({
                    original: `${original} ${suffix}`,
                    adjusted: `${adjustedNum} ${suffix}`,
                    type: 'stitch',
                });
            }
            return `${adjustedNum} ${suffix}`;
        });
        // Find and replace row counts
        // Patterns: "work 120 rows", "for 45 rows", "120 rows", "row 10"
        adjusted = adjusted.replace(/(\d+)\s*rows?/gi, (match, num) => {
            const original = parseInt(num, 10);
            const adjustedNum = Math.round(original * rowMultiplier);
            if (original !== adjustedNum) {
                changes.push({
                    original: `${original} rows`,
                    adjusted: `${adjustedNum} rows`,
                    type: 'row',
                });
            }
            return `${adjustedNum} rows`;
        });
        // Adjust repeat intervals
        // Patterns: "every 8 rows", "every 4th row", "every 8th row"
        adjusted = adjusted.replace(/every\s+(\d+)(?:th|st|nd|rd)?\s+rows?/gi, (match, num) => {
            const original = parseInt(num, 10);
            const adjustedNum = Math.max(1, Math.round(original * rowMultiplier));
            const suffix = this.getOrdinalSuffix(adjustedNum);
            if (original !== adjustedNum) {
                changes.push({
                    original: `every ${original}${this.getOrdinalSuffix(original)} row`,
                    adjusted: `every ${adjustedNum}${suffix} row`,
                    type: 'interval',
                });
            }
            return `every ${adjustedNum}${suffix} row`;
        });
        // Adjust "at row X" patterns
        adjusted = adjusted.replace(/at\s+row\s+(\d+)/gi, (match, num) => {
            const original = parseInt(num, 10);
            const adjustedNum = Math.round(original * rowMultiplier);
            if (original !== adjustedNum) {
                changes.push({
                    original: `at row ${original}`,
                    adjusted: `at row ${adjustedNum}`,
                    type: 'row',
                });
            }
            return `at row ${adjustedNum}`;
        });
        // Adjust "rows X-Y" range patterns
        adjusted = adjusted.replace(/rows?\s+(\d+)\s*[-–]\s*(\d+)/gi, (match, start, end) => {
            const originalStart = parseInt(start, 10);
            const originalEnd = parseInt(end, 10);
            const adjustedStart = Math.round(originalStart * rowMultiplier);
            const adjustedEnd = Math.round(originalEnd * rowMultiplier);
            if (originalStart !== adjustedStart || originalEnd !== adjustedEnd) {
                changes.push({
                    original: `rows ${originalStart}-${originalEnd}`,
                    adjusted: `rows ${adjustedStart}-${adjustedEnd}`,
                    type: 'row',
                });
            }
            return `rows ${adjustedStart}-${adjustedEnd}`;
        });
        return { adjusted, changes };
    }
    /**
     * Get ordinal suffix for a number
     */
    getOrdinalSuffix(num) {
        const lastDigit = num % 10;
        const lastTwoDigits = num % 100;
        if (lastTwoDigits >= 11 && lastTwoDigits <= 13)
            return 'th';
        if (lastDigit === 1)
            return 'st';
        if (lastDigit === 2)
            return 'nd';
        if (lastDigit === 3)
            return 'rd';
        return 'th';
    }
    /**
     * Generate side-by-side comparison
     */
    generateComparisonView(original, adjusted) {
        const originalLines = original.split('\n');
        const adjustedLines = adjusted.split('\n');
        const comparison = [];
        const maxLines = Math.max(originalLines.length, adjustedLines.length);
        for (let i = 0; i < maxLines; i++) {
            const origLine = originalLines[i] || '';
            const adjLine = adjustedLines[i] || '';
            comparison.push({
                original: origLine,
                adjusted: adjLine,
                line_number: i + 1,
                changed: origLine !== adjLine,
            });
        }
        return comparison;
    }
    /**
     * Calculate gauge adjustment for a pattern
     */
    async calculateAdjustment(patternId, patternGauge, actualGauge) {
        // Get pattern instructions
        const pattern = await (0, database_1.default)('patterns').where({ id: patternId }).first();
        if (!pattern) {
            throw new Error('Pattern not found');
        }
        const originalInstructions = pattern.notes || '';
        const comparison = this.compareGauge(patternGauge, actualGauge);
        const { adjusted, changes } = this.adjustPatternInstructions(originalInstructions, comparison.stitch_multiplier, comparison.row_multiplier);
        return {
            comparison,
            original_instructions: originalInstructions,
            adjusted_instructions: adjusted,
            changes,
        };
    }
    /**
     * Apply gauge adjustment to a project
     */
    async applyAdjustment(projectId, userId, patternGauge, actualGauge, adjustedInstructions, originalInstructions) {
        const comparison = this.compareGauge(patternGauge, actualGauge);
        // Update project with gauge data
        const [project] = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .update({
            pattern_gauge_stitches: patternGauge.stitches,
            pattern_gauge_rows: patternGauge.rows,
            pattern_gauge_measurement: patternGauge.measurement,
            actual_gauge_stitches: actualGauge.stitches,
            actual_gauge_rows: actualGauge.rows,
            actual_gauge_measurement: actualGauge.measurement,
            gauge_adjusted: true,
            adjusted_instructions: adjustedInstructions,
            original_instructions: originalInstructions,
            updated_at: new Date(),
        })
            .returning('*');
        // Store adjustment history
        await (0, database_1.default)('gauge_adjustments').insert({
            project_id: projectId,
            original_instructions: originalInstructions,
            adjusted_instructions: adjustedInstructions,
            pattern_gauge_stitches: patternGauge.stitches,
            pattern_gauge_rows: patternGauge.rows,
            actual_gauge_stitches: actualGauge.stitches,
            actual_gauge_rows: actualGauge.rows,
            stitch_multiplier: comparison.stitch_multiplier,
            row_multiplier: comparison.row_multiplier,
            stitch_difference_percent: comparison.stitch_difference_percent,
            row_difference_percent: comparison.row_difference_percent,
        });
        logger_1.default.info('Gauge adjustment applied', {
            projectId,
            userId,
            stitchDiff: comparison.stitch_difference_percent,
            rowDiff: comparison.row_difference_percent,
        });
        return project;
    }
    /**
     * Get adjustment history for a project
     */
    async getAdjustmentHistory(projectId, userId) {
        // Verify project belongs to user
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .first();
        if (!project) {
            throw new Error('Project not found');
        }
        return (0, database_1.default)('gauge_adjustments')
            .where({ project_id: projectId })
            .orderBy('created_at', 'desc');
    }
    /**
     * Clear gauge adjustment from project
     */
    async clearAdjustment(projectId, userId) {
        const [project] = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .update({
            gauge_adjusted: false,
            adjusted_instructions: null,
            actual_gauge_stitches: null,
            actual_gauge_rows: null,
            updated_at: new Date(),
        })
            .returning('*');
        return project;
    }
}
exports.default = new GaugeAdjustmentService();
