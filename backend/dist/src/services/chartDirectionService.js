"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../config/database"));
class ChartDirectionService {
    /**
     * Calculate direction for a given row based on working direction
     */
    calculateRowDirection(workingDirection, rowNumber) {
        switch (workingDirection) {
            case 'flat_knitting':
                // Odd rows (1, 3, 5...): RS, left-to-right
                // Even rows (2, 4, 6...): WS, right-to-left
                return rowNumber % 2 === 1 ? 'left_to_right' : 'right_to_left';
            case 'in_the_round':
                // Always left-to-right
                return 'left_to_right';
            case 'flat_from_center':
                // Center outward (special handling)
                return 'center_out';
            default:
                return 'left_to_right';
        }
    }
    /**
     * Get starting position for a row based on direction
     */
    getRowStartPosition(chartWidth, direction) {
        switch (direction) {
            case 'left_to_right':
                return 0; // Start at left
            case 'right_to_left':
                return chartWidth - 1; // Start at right
            case 'center_out':
                return Math.floor(chartWidth / 2); // Start at center
            default:
                return 0;
        }
    }
    /**
     * Get next stitch position based on current direction
     */
    getNextStitchPosition(currentRow, currentCol, chartWidth, chartHeight, direction, workingDirection) {
        let newRow = currentRow;
        let newCol = currentCol;
        let isRowComplete = false;
        switch (direction) {
            case 'left_to_right':
                if (currentCol < chartWidth - 1) {
                    // Move right
                    newCol = currentCol + 1;
                }
                else {
                    // End of row, move to next row
                    isRowComplete = true;
                    newRow = currentRow + 1;
                    const newDirection = this.calculateRowDirection(workingDirection, newRow + 1);
                    newCol = this.getRowStartPosition(chartWidth, newDirection);
                }
                break;
            case 'right_to_left':
                if (currentCol > 0) {
                    // Move left
                    newCol = currentCol - 1;
                }
                else {
                    // End of row, move to next row (start from right)
                    isRowComplete = true;
                    newRow = currentRow + 1;
                    const newDirection = this.calculateRowDirection(workingDirection, newRow + 1);
                    newCol = this.getRowStartPosition(chartWidth, newDirection);
                }
                break;
            case 'center_out':
                const center = Math.floor(chartWidth / 2);
                const distanceFromCenter = Math.abs(currentCol - center);
                if (currentCol >= center && currentCol < chartWidth - 1) {
                    // Right half: move right
                    newCol = currentCol + 1;
                }
                else if (currentCol < center && currentCol > 0) {
                    // Left half: move left
                    newCol = currentCol - 1;
                }
                else {
                    // End of row, move to next row at center
                    isRowComplete = true;
                    newRow = currentRow + 1;
                    newCol = center;
                }
                break;
        }
        // Clamp to valid range
        if (newRow >= chartHeight) {
            newRow = chartHeight - 1;
            isRowComplete = false; // Can't go further
        }
        const newDirection = this.calculateRowDirection(workingDirection, newRow + 1);
        return {
            row: newRow,
            col: newCol,
            direction: newDirection,
            isRowComplete,
        };
    }
    /**
     * Get previous stitch position (for undo/back)
     */
    getPreviousStitchPosition(currentRow, currentCol, chartWidth, direction, workingDirection) {
        let newRow = currentRow;
        let newCol = currentCol;
        switch (direction) {
            case 'left_to_right':
                if (currentCol > 0) {
                    newCol = currentCol - 1;
                }
                else if (currentRow > 0) {
                    // Beginning of row, go to end of previous row
                    newRow = currentRow - 1;
                    const prevDirection = this.calculateRowDirection(workingDirection, newRow + 1);
                    newCol = prevDirection === 'left_to_right' ? chartWidth - 1 : 0;
                }
                break;
            case 'right_to_left':
                if (currentCol < chartWidth - 1) {
                    newCol = currentCol + 1;
                }
                else if (currentRow > 0) {
                    // End of row, go to start of previous row
                    newRow = currentRow - 1;
                    const prevDirection = this.calculateRowDirection(workingDirection, newRow + 1);
                    newCol = prevDirection === 'right_to_left' ? 0 : chartWidth - 1;
                }
                break;
            case 'center_out':
                const center = Math.floor(chartWidth / 2);
                if (currentCol !== center) {
                    // Move toward center
                    newCol = currentCol > center ? currentCol - 1 : currentCol + 1;
                }
                else if (currentRow > 0) {
                    // At center, go to previous row
                    newRow = currentRow - 1;
                    newCol = center;
                }
                break;
        }
        const newDirection = this.calculateRowDirection(workingDirection, newRow + 1);
        return {
            row: newRow,
            col: newCol,
            direction: newDirection,
            isRowComplete: false,
        };
    }
    /**
     * Set working direction for a chart
     */
    async setWorkingDirection(projectId, chartId, userId, workingDirection) {
        // Verify project belongs to user
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .first();
        if (!project) {
            throw new Error('Project not found');
        }
        // Calculate initial direction based on current row
        const progress = await (0, database_1.default)('chart_progress')
            .where({ project_id: projectId, chart_id: chartId })
            .first();
        const currentRow = progress?.current_row || 0;
        const currentDirection = this.calculateRowDirection(workingDirection, currentRow + 1);
        // Update or create progress record
        const [updated] = await (0, database_1.default)('chart_progress')
            .insert({
            project_id: projectId,
            chart_id: chartId,
            working_direction: workingDirection,
            current_direction: currentDirection,
            current_row: currentRow,
            current_column: progress?.current_column || 0,
            completed_cells: progress?.completed_cells || JSON.stringify([]),
            completed_rows: progress?.completed_rows || JSON.stringify([]),
        })
            .onConflict(['project_id', 'chart_id'])
            .merge({
            working_direction: workingDirection,
            current_direction: currentDirection,
            updated_at: new Date(),
        })
            .returning('*');
        return updated;
    }
    /**
     * Advance stitch in working direction
     */
    async advanceStitch(projectId, chartId, userId, direction, chartWidth, chartHeight) {
        // Verify project belongs to user
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .first();
        if (!project) {
            throw new Error('Project not found');
        }
        // Get current progress
        let progress = await (0, database_1.default)('chart_progress')
            .where({ project_id: projectId, chart_id: chartId })
            .first();
        if (!progress) {
            // Create default progress
            [progress] = await (0, database_1.default)('chart_progress')
                .insert({
                project_id: projectId,
                chart_id: chartId,
                current_row: 0,
                current_column: 0,
                working_direction: 'flat_knitting',
                current_direction: 'left_to_right',
                completed_cells: JSON.stringify([]),
                completed_rows: JSON.stringify([]),
            })
                .returning('*');
        }
        const workingDirection = progress.working_direction;
        const currentDirection = progress.current_direction;
        let newPosition;
        if (direction === 'forward') {
            newPosition = this.getNextStitchPosition(progress.current_row, progress.current_column, chartWidth, chartHeight, currentDirection, workingDirection);
            // Mark current cell as completed if moving forward
            let completedCells = typeof progress.completed_cells === 'string'
                ? JSON.parse(progress.completed_cells)
                : progress.completed_cells;
            const cellExists = completedCells.some((c) => c.row === progress.current_row && c.col === progress.current_column);
            if (!cellExists) {
                completedCells.push({ row: progress.current_row, col: progress.current_column });
            }
            // Store direction history
            await (0, database_1.default)('chart_direction_history').insert({
                chart_progress_id: progress.id,
                row_number: progress.current_row,
                direction: currentDirection,
                column_position: progress.current_column,
            });
            // Update progress
            const [updated] = await (0, database_1.default)('chart_progress')
                .where({ id: progress.id })
                .update({
                current_row: newPosition.row,
                current_column: newPosition.col,
                current_direction: newPosition.direction,
                completed_cells: JSON.stringify(completedCells),
                updated_at: new Date(),
            })
                .returning('*');
            return {
                current_row: updated.current_row,
                current_column: updated.current_column,
                current_direction: updated.current_direction,
                working_direction: updated.working_direction,
                is_row_complete: newPosition.isRowComplete,
            };
        }
        else {
            // Backward direction
            newPosition = this.getPreviousStitchPosition(progress.current_row, progress.current_column, chartWidth, currentDirection, workingDirection);
            // Remove cell from completed if going backward
            let completedCells = typeof progress.completed_cells === 'string'
                ? JSON.parse(progress.completed_cells)
                : progress.completed_cells;
            completedCells = completedCells.filter((c) => !(c.row === newPosition.row && c.col === newPosition.col));
            const [updated] = await (0, database_1.default)('chart_progress')
                .where({ id: progress.id })
                .update({
                current_row: newPosition.row,
                current_column: newPosition.col,
                current_direction: newPosition.direction,
                completed_cells: JSON.stringify(completedCells),
                updated_at: new Date(),
            })
                .returning('*');
            return {
                current_row: updated.current_row,
                current_column: updated.current_column,
                current_direction: updated.current_direction,
                working_direction: updated.working_direction,
                is_row_complete: false,
            };
        }
    }
    /**
     * Toggle direction for current row (manual override)
     */
    async toggleDirection(projectId, chartId, userId) {
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .first();
        if (!project) {
            throw new Error('Project not found');
        }
        const progress = await (0, database_1.default)('chart_progress')
            .where({ project_id: projectId, chart_id: chartId })
            .first();
        if (!progress) {
            throw new Error('No chart progress found');
        }
        const currentDirection = progress.current_direction;
        const newDirection = currentDirection === 'left_to_right' ? 'right_to_left' : 'left_to_right';
        const [updated] = await (0, database_1.default)('chart_progress')
            .where({ id: progress.id })
            .update({
            current_direction: newDirection,
            updated_at: new Date(),
        })
            .returning('*');
        return updated;
    }
}
exports.default = new ChartDirectionService();
