import { Request, Response } from 'express';
import db from '../config/database';
import logger from '../config/logger';

interface CompletedCell {
  row: number;
  col: number;
}

/**
 * Get chart progress for a project
 * GET /api/projects/:projectId/charts/:chartId/progress
 */
export async function getProgress(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { projectId, chartId } = req.params;

  try {
    // Verify project belongs to user
    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .first();

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    // Get or create progress record
    let progress = await db('chart_progress')
      .where({ project_id: projectId, chart_id: chartId })
      .first();

    if (!progress) {
      // Create default progress
      [progress] = await db('chart_progress')
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
  } catch (error) {
    logger.error('Error fetching chart progress', {
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
export async function updateProgress(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { projectId, chartId } = req.params;
  const { current_row, current_column, completed_cells, completed_rows, tracking_enabled } = req.body;

  try {
    // Verify project belongs to user
    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .first();

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const updateData: any = { updated_at: new Date() };
    if (current_row !== undefined) updateData.current_row = current_row;
    if (current_column !== undefined) updateData.current_column = current_column;
    if (completed_cells !== undefined) updateData.completed_cells = JSON.stringify(completed_cells);
    if (completed_rows !== undefined) updateData.completed_rows = JSON.stringify(completed_rows);
    if (tracking_enabled !== undefined) updateData.tracking_enabled = tracking_enabled;

    // Upsert progress
    const [progress] = await db('chart_progress')
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
  } catch (error) {
    logger.error('Error updating chart progress', {
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
export async function markCell(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { projectId, chartId } = req.params;
  const { row, column, completed } = req.body;

  try {
    // Verify project belongs to user
    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .first();

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    // Get current progress
    let progress = await db('chart_progress')
      .where({ project_id: projectId, chart_id: chartId })
      .first();

    if (!progress) {
      // Create default progress
      [progress] = await db('chart_progress')
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

    let completedCells: CompletedCell[] = typeof progress.completed_cells === 'string'
      ? JSON.parse(progress.completed_cells)
      : progress.completed_cells;

    if (completed) {
      // Add cell if not already completed
      const exists = completedCells.some(c => c.row === row && c.col === column);
      if (!exists) {
        completedCells.push({ row, col: column });
      }
    } else {
      // Remove cell
      completedCells = completedCells.filter(c => !(c.row === row && c.col === column));
    }

    // Update progress
    const [updated] = await db('chart_progress')
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
  } catch (error) {
    logger.error('Error marking cell', {
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
export async function markRow(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { projectId, chartId } = req.params;
  const { row, completed, totalColumns } = req.body;

  try {
    // Verify project belongs to user
    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .first();

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    // Get current progress
    let progress = await db('chart_progress')
      .where({ project_id: projectId, chart_id: chartId })
      .first();

    if (!progress) {
      [progress] = await db('chart_progress')
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

    let completedCells: CompletedCell[] = typeof progress.completed_cells === 'string'
      ? JSON.parse(progress.completed_cells)
      : progress.completed_cells;

    let completedRows: number[] = typeof progress.completed_rows === 'string'
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
    } else {
      // Remove row from completed rows
      completedRows = completedRows.filter(r => r !== row);
      // Remove all cells from this row
      completedCells = completedCells.filter(c => c.row !== row);
    }

    // Update progress
    const [updated] = await db('chart_progress')
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
  } catch (error) {
    logger.error('Error marking row', {
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
export async function clearProgress(req: Request, res: Response): Promise<void> {
  const userId = req.user!.id;
  const { projectId, chartId } = req.params;

  try {
    // Verify project belongs to user
    const project = await db('projects')
      .where({ id: projectId, user_id: userId })
      .first();

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    // Reset progress
    const [progress] = await db('chart_progress')
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
  } catch (error) {
    logger.error('Error clearing progress', {
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
