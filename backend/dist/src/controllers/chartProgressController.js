"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProgress = getProgress;
exports.updateProgress = updateProgress;
exports.markCell = markCell;
exports.markRow = markRow;
exports.clearProgress = clearProgress;
exports.setDirection = setDirection;
exports.advanceStitch = advanceStitch;
exports.toggleDirection = toggleDirection;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../config/logger"));
const chartDirectionService_1 = __importDefault(require("../services/chartDirectionService"));
/**
 * Get chart progress for a project
 * GET /api/projects/:projectId/charts/:chartId/progress
 */
async function getProgress(req, res) {
    const userId = req.user.userId;
    const { projectId, chartId } = req.params;
    try {
        // Verify project belongs to user
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .first();
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        // Get or create progress record
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
                completed_cells: JSON.stringify([]),
                completed_rows: JSON.stringify([]),
            })
                .returning('*');
        }
        res.status(200).json({
            success: true,
            data: {
                current_row: progress.current_row,
                current_column: progress.current_column,
                completed_cells: typeof progress.completed_cells === 'string'
                    ? JSON.parse(progress.completed_cells)
                    : progress.completed_cells,
                completed_rows: typeof progress.completed_rows === 'string'
                    ? JSON.parse(progress.completed_rows)
                    : progress.completed_rows,
                tracking_enabled: progress.tracking_enabled,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Error fetching chart progress', {
            userId,
            projectId,
            chartId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.status(500).json({
            success: false,
            error: 'Failed to fetch chart progress',
        });
    }
}
/**
 * Update chart progress
 * POST /api/projects/:projectId/charts/:chartId/progress
 */
async function updateProgress(req, res) {
    const userId = req.user.userId;
    const { projectId, chartId } = req.params;
    const { current_row, current_column, completed_cells, completed_rows, tracking_enabled } = req.body;
    try {
        // Verify project belongs to user
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .first();
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        const updateData = { updated_at: new Date() };
        if (current_row !== undefined)
            updateData.current_row = current_row;
        if (current_column !== undefined)
            updateData.current_column = current_column;
        if (completed_cells !== undefined)
            updateData.completed_cells = JSON.stringify(completed_cells);
        if (completed_rows !== undefined)
            updateData.completed_rows = JSON.stringify(completed_rows);
        if (tracking_enabled !== undefined)
            updateData.tracking_enabled = tracking_enabled;
        // Upsert progress
        const [progress] = await (0, database_1.default)('chart_progress')
            .insert({
            project_id: projectId,
            chart_id: chartId,
            ...updateData,
        })
            .onConflict(['project_id', 'chart_id'])
            .merge(updateData)
            .returning('*');
        res.status(200).json({
            success: true,
            data: {
                current_row: progress.current_row,
                current_column: progress.current_column,
                completed_cells: typeof progress.completed_cells === 'string'
                    ? JSON.parse(progress.completed_cells)
                    : progress.completed_cells,
                completed_rows: typeof progress.completed_rows === 'string'
                    ? JSON.parse(progress.completed_rows)
                    : progress.completed_rows,
                tracking_enabled: progress.tracking_enabled,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Error updating chart progress', {
            userId,
            projectId,
            chartId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.status(500).json({
            success: false,
            error: 'Failed to update chart progress',
        });
    }
}
/**
 * Mark a single cell as complete/incomplete
 * POST /api/projects/:projectId/charts/:chartId/mark-cell
 */
async function markCell(req, res) {
    const userId = req.user.userId;
    const { projectId, chartId } = req.params;
    const { row, column, completed } = req.body;
    try {
        // Verify project belongs to user
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .first();
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
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
                current_row: row,
                current_column: column,
                completed_cells: JSON.stringify([]),
                completed_rows: JSON.stringify([]),
            })
                .returning('*');
        }
        let completedCells = typeof progress.completed_cells === 'string'
            ? JSON.parse(progress.completed_cells)
            : progress.completed_cells;
        if (completed) {
            // Add cell if not already completed
            const exists = completedCells.some(c => c.row === row && c.col === column);
            if (!exists) {
                completedCells.push({ row, col: column });
            }
        }
        else {
            // Remove cell
            completedCells = completedCells.filter(c => !(c.row === row && c.col === column));
        }
        // Update progress
        const [updated] = await (0, database_1.default)('chart_progress')
            .where({ project_id: projectId, chart_id: chartId })
            .update({
            completed_cells: JSON.stringify(completedCells),
            current_row: row,
            current_column: column,
            updated_at: new Date(),
        })
            .returning('*');
        res.status(200).json({
            success: true,
            data: {
                current_row: updated.current_row,
                current_column: updated.current_column,
                completed_cells: completedCells,
                completed_rows: typeof updated.completed_rows === 'string'
                    ? JSON.parse(updated.completed_rows)
                    : updated.completed_rows,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Error marking cell', {
            userId,
            projectId,
            chartId,
            row,
            column,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.status(500).json({
            success: false,
            error: 'Failed to mark cell',
        });
    }
}
/**
 * Mark an entire row as complete
 * POST /api/projects/:projectId/charts/:chartId/mark-row
 */
async function markRow(req, res) {
    const userId = req.user.userId;
    const { projectId, chartId } = req.params;
    const { row, completed, totalColumns } = req.body;
    try {
        // Verify project belongs to user
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .first();
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        // Get current progress
        let progress = await (0, database_1.default)('chart_progress')
            .where({ project_id: projectId, chart_id: chartId })
            .first();
        if (!progress) {
            [progress] = await (0, database_1.default)('chart_progress')
                .insert({
                project_id: projectId,
                chart_id: chartId,
                current_row: row,
                current_column: 0,
                completed_cells: JSON.stringify([]),
                completed_rows: JSON.stringify([]),
            })
                .returning('*');
        }
        let completedCells = typeof progress.completed_cells === 'string'
            ? JSON.parse(progress.completed_cells)
            : progress.completed_cells;
        let completedRows = typeof progress.completed_rows === 'string'
            ? JSON.parse(progress.completed_rows)
            : progress.completed_rows;
        if (completed) {
            // Add row to completed rows if not already
            if (!completedRows.includes(row)) {
                completedRows.push(row);
            }
            // Add all cells in the row
            const cols = totalColumns || 20; // Default to 20 columns if not specified
            for (let col = 0; col < cols; col++) {
                const exists = completedCells.some(c => c.row === row && c.col === col);
                if (!exists) {
                    completedCells.push({ row, col });
                }
            }
        }
        else {
            // Remove row from completed rows
            completedRows = completedRows.filter(r => r !== row);
            // Remove all cells from this row
            completedCells = completedCells.filter(c => c.row !== row);
        }
        // Update progress
        const [updated] = await (0, database_1.default)('chart_progress')
            .where({ project_id: projectId, chart_id: chartId })
            .update({
            completed_cells: JSON.stringify(completedCells),
            completed_rows: JSON.stringify(completedRows),
            current_row: completed ? row + 1 : row,
            updated_at: new Date(),
        })
            .returning('*');
        res.status(200).json({
            success: true,
            data: {
                current_row: updated.current_row,
                current_column: updated.current_column,
                completed_cells: completedCells,
                completed_rows: completedRows,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Error marking row', {
            userId,
            projectId,
            chartId,
            row,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.status(500).json({
            success: false,
            error: 'Failed to mark row',
        });
    }
}
/**
 * Clear all progress for a chart
 * DELETE /api/projects/:projectId/charts/:chartId/progress
 */
async function clearProgress(req, res) {
    const userId = req.user.userId;
    const { projectId, chartId } = req.params;
    try {
        // Verify project belongs to user
        const project = await (0, database_1.default)('projects')
            .where({ id: projectId, user_id: userId })
            .first();
        if (!project) {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        // Reset progress
        const [progress] = await (0, database_1.default)('chart_progress')
            .where({ project_id: projectId, chart_id: chartId })
            .update({
            current_row: 0,
            current_column: 0,
            completed_cells: JSON.stringify([]),
            completed_rows: JSON.stringify([]),
            updated_at: new Date(),
        })
            .returning('*');
        if (!progress) {
            res.status(404).json({ success: false, error: 'No progress found to clear' });
            return;
        }
        res.status(200).json({
            success: true,
            message: 'Progress cleared',
            data: {
                current_row: 0,
                current_column: 0,
                completed_cells: [],
                completed_rows: [],
            },
        });
    }
    catch (error) {
        logger_1.default.error('Error clearing progress', {
            userId,
            projectId,
            chartId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        res.status(500).json({
            success: false,
            error: 'Failed to clear progress',
        });
    }
}
/**
 * Set working direction for a chart
 * POST /api/projects/:projectId/charts/:chartId/set-direction
 */
async function setDirection(req, res) {
    const userId = req.user.userId;
    const { projectId, chartId } = req.params;
    const { working_direction } = req.body;
    try {
        const validDirections = ['flat_knitting', 'in_the_round', 'flat_from_center'];
        if (!validDirections.includes(working_direction)) {
            res.status(400).json({
                success: false,
                error: 'Invalid working direction',
            });
            return;
        }
        const progress = await chartDirectionService_1.default.setWorkingDirection(projectId, chartId, userId, working_direction);
        res.status(200).json({
            success: true,
            data: {
                working_direction: progress.working_direction,
                current_direction: progress.current_direction,
                current_row: progress.current_row,
                current_column: progress.current_column,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Error setting direction', {
            userId,
            projectId,
            chartId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        if (error instanceof Error && error.message === 'Project not found') {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        res.status(500).json({
            success: false,
            error: 'Failed to set direction',
        });
    }
}
/**
 * Advance stitch in working direction
 * POST /api/projects/:projectId/charts/:chartId/advance-stitch
 */
async function advanceStitch(req, res) {
    const userId = req.user.userId;
    const { projectId, chartId } = req.params;
    const { direction, chart_width, chart_height } = req.body;
    try {
        if (!['forward', 'backward'].includes(direction)) {
            res.status(400).json({
                success: false,
                error: 'Direction must be "forward" or "backward"',
            });
            return;
        }
        const result = await chartDirectionService_1.default.advanceStitch(projectId, chartId, userId, direction, chart_width || 20, chart_height || 20);
        res.status(200).json({
            success: true,
            data: result,
        });
    }
    catch (error) {
        logger_1.default.error('Error advancing stitch', {
            userId,
            projectId,
            chartId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        if (error instanceof Error && error.message === 'Project not found') {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        res.status(500).json({
            success: false,
            error: 'Failed to advance stitch',
        });
    }
}
/**
 * Toggle direction for current row
 * POST /api/projects/:projectId/charts/:chartId/toggle-direction
 */
async function toggleDirection(req, res) {
    const userId = req.user.userId;
    const { projectId, chartId } = req.params;
    try {
        const progress = await chartDirectionService_1.default.toggleDirection(projectId, chartId, userId);
        res.status(200).json({
            success: true,
            data: {
                current_direction: progress.current_direction,
                current_row: progress.current_row,
                current_column: progress.current_column,
            },
        });
    }
    catch (error) {
        logger_1.default.error('Error toggling direction', {
            userId,
            projectId,
            chartId,
            error: error instanceof Error ? error.message : 'Unknown error',
        });
        if (error instanceof Error && error.message === 'Project not found') {
            res.status(404).json({ success: false, error: 'Project not found' });
            return;
        }
        res.status(500).json({
            success: false,
            error: 'Failed to toggle direction',
        });
    }
}
