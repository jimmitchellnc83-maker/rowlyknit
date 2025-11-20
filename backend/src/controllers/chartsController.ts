import { Request, Response } from 'express';
import db from '../config/database';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errorHandler';
import { createAuditLog } from '../middleware/auditLog';

/**
 * Get all charts for a pattern
 */
export async function getCharts(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { patternId } = req.params;

  // Verify pattern ownership
  const pattern = await db('patterns')
    .where({ id: patternId, user_id: userId })
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  const charts = await db('pattern_charts')
    .where({ pattern_id: patternId })
    .orderBy('sort_order', 'asc');

  res.json({
    success: true,
    data: { charts },
  });
}

/**
 * Get a single chart with its cells and symbols
 */
export async function getChart(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { patternId, chartId } = req.params;

  // Verify pattern ownership
  const pattern = await db('patterns')
    .where({ id: patternId, user_id: userId })
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  // Get chart
  const chart = await db('pattern_charts')
    .where({ id: chartId, pattern_id: patternId })
    .first();

  if (!chart) {
    throw new NotFoundError('Chart not found');
  }

  // Get chart cells with symbol details
  const cells = await db('chart_cells')
    .where({ chart_id: chartId })
    .select('row', 'col', 'symbol_id')
    .orderBy(['row', 'col']);

  // Get symbols used in this chart
  const symbolIds = await db('chart_symbol_associations')
    .where({ chart_id: chartId })
    .pluck('symbol_id');

  const symbols = await db('chart_symbols')
    .whereIn('id', symbolIds)
    .select('id', 'symbol', 'name', 'description', 'color', 'category');

  // Format cells for frontend
  const chartData = cells.map(cell => ({
    row: cell.row,
    col: cell.col,
    symbol: cell.symbol_id,
  }));

  res.json({
    success: true,
    data: {
      chart: {
        ...chart,
        chartData,
        symbols,
      },
    },
  });
}

/**
 * Create a new chart
 */
export async function createChart(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { patternId } = req.params;
  const { title, rows, cols, isInTheRound, notes, chartData, symbolIds } = req.body;

  if (!title || !rows || !cols) {
    throw new ValidationError('Title, rows, and cols are required');
  }

  if (rows < 1 || rows > 1000) {
    throw new ValidationError('Rows must be between 1 and 1000');
  }

  if (cols < 1 || cols > 1000) {
    throw new ValidationError('Cols must be between 1 and 1000');
  }

  // Verify pattern ownership
  const pattern = await db('patterns')
    .where({ id: patternId, user_id: userId })
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  // Get max sort order
  const maxSortOrder = await db('pattern_charts')
    .where({ pattern_id: patternId })
    .max('sort_order as max')
    .first();

  const sortOrder = (maxSortOrder?.max ?? -1) + 1;

  // Create chart in transaction
  const chart = await db.transaction(async (trx) => {
    // Insert chart
    const [newChart] = await trx('pattern_charts')
      .insert({
        pattern_id: patternId,
        title,
        rows,
        cols,
        is_in_the_round: isInTheRound || false,
        notes,
        sort_order: sortOrder,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning('*');

    // Insert chart cells if provided
    if (chartData && Array.isArray(chartData) && chartData.length > 0) {
      const cells = chartData.map((cell: any) => ({
        chart_id: newChart.id,
        row: cell.row,
        col: cell.col,
        symbol_id: cell.symbol,
        created_at: new Date(),
      }));

      await trx('chart_cells').insert(cells);
    }

    // Insert symbol associations if provided
    if (symbolIds && Array.isArray(symbolIds) && symbolIds.length > 0) {
      const associations = symbolIds.map((symbolId: string) => ({
        chart_id: newChart.id,
        symbol_id: symbolId,
        created_at: new Date(),
      }));

      await trx('chart_symbol_associations').insert(associations);
    }

    return newChart;
  });

  await createAuditLog(req, {
    userId,
    action: 'chart_created',
    entityType: 'chart',
    entityId: chart.id,
    newValues: chart,
  });

  res.status(201).json({
    success: true,
    message: 'Chart created successfully',
    data: { chart },
  });
}

/**
 * Update a chart
 */
export async function updateChart(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { patternId, chartId } = req.params;
  const { title, rows, cols, isInTheRound, notes, chartData, symbolIds } = req.body;

  // Verify pattern ownership
  const pattern = await db('patterns')
    .where({ id: patternId, user_id: userId })
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  // Get chart
  const chart = await db('pattern_charts')
    .where({ id: chartId, pattern_id: patternId })
    .first();

  if (!chart) {
    throw new NotFoundError('Chart not found');
  }

  // Update chart in transaction
  const updatedChart = await db.transaction(async (trx) => {
    // Update chart metadata
    const updateData: any = {
      updated_at: new Date(),
    };

    if (title !== undefined) updateData.title = title;
    if (rows !== undefined) {
      if (rows < 1 || rows > 1000) {
        throw new ValidationError('Rows must be between 1 and 1000');
      }
      updateData.rows = rows;
    }
    if (cols !== undefined) {
      if (cols < 1 || cols > 1000) {
        throw new ValidationError('Cols must be between 1 and 1000');
      }
      updateData.cols = cols;
    }
    if (isInTheRound !== undefined) updateData.is_in_the_round = isInTheRound;
    if (notes !== undefined) updateData.notes = notes;

    const [updated] = await trx('pattern_charts')
      .where({ id: chartId })
      .update(updateData)
      .returning('*');

    // Update chart cells if provided
    if (chartData && Array.isArray(chartData)) {
      // Delete existing cells
      await trx('chart_cells').where({ chart_id: chartId }).del();

      // Insert new cells
      if (chartData.length > 0) {
        const cells = chartData.map((cell: any) => ({
          chart_id: chartId,
          row: cell.row,
          col: cell.col,
          symbol_id: cell.symbol,
          created_at: new Date(),
        }));

        await trx('chart_cells').insert(cells);
      }
    }

    // Update symbol associations if provided
    if (symbolIds && Array.isArray(symbolIds)) {
      // Delete existing associations
      await trx('chart_symbol_associations').where({ chart_id: chartId }).del();

      // Insert new associations
      if (symbolIds.length > 0) {
        const associations = symbolIds.map((symbolId: string) => ({
          chart_id: chartId,
          symbol_id: symbolId,
          created_at: new Date(),
        }));

        await trx('chart_symbol_associations').insert(associations);
      }
    }

    return updated;
  });

  await createAuditLog(req, {
    userId,
    action: 'chart_updated',
    entityType: 'chart',
    entityId: chartId,
    oldValues: chart,
    newValues: updatedChart,
  });

  res.json({
    success: true,
    message: 'Chart updated successfully',
    data: { chart: updatedChart },
  });
}

/**
 * Delete a chart
 */
export async function deleteChart(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { patternId, chartId } = req.params;

  // Verify pattern ownership
  const pattern = await db('patterns')
    .where({ id: patternId, user_id: userId })
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  // Get chart
  const chart = await db('pattern_charts')
    .where({ id: chartId, pattern_id: patternId })
    .first();

  if (!chart) {
    throw new NotFoundError('Chart not found');
  }

  // Delete chart (cascades to cells and associations)
  await db('pattern_charts').where({ id: chartId }).del();

  await createAuditLog(req, {
    userId,
    action: 'chart_deleted',
    entityType: 'chart',
    entityId: chartId,
    oldValues: chart,
  });

  res.json({
    success: true,
    message: 'Chart deleted successfully',
  });
}

/**
 * Reorder charts
 */
export async function reorderCharts(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { patternId } = req.params;
  const { charts } = req.body;

  if (!Array.isArray(charts)) {
    throw new ValidationError('Charts must be an array');
  }

  // Verify pattern ownership
  const pattern = await db('patterns')
    .where({ id: patternId, user_id: userId })
    .first();

  if (!pattern) {
    throw new NotFoundError('Pattern not found');
  }

  // Update sort orders in transaction
  await db.transaction(async (trx) => {
    for (let i = 0; i < charts.length; i++) {
      await trx('pattern_charts')
        .where({ id: charts[i].id, pattern_id: patternId })
        .update({ sort_order: i, updated_at: new Date() });
    }
  });

  res.json({
    success: true,
    message: 'Charts reordered successfully',
  });
}

/**
 * Get all available chart symbols
 */
export async function getSymbols(req: Request, res: Response) {
  const userId = (req as any).user.userId;

  // Get standard symbols and user's custom symbols
  const symbols = await db('chart_symbols')
    .where((builder) => {
      builder.where('is_custom', false).orWhere('user_id', userId);
    })
    .orderBy(['category', 'name']);

  res.json({
    success: true,
    data: { symbols },
  });
}

/**
 * Create a custom symbol
 */
export async function createSymbol(req: Request, res: Response) {
  const userId = (req as any).user.userId;
  const { symbol, name, description, color, category } = req.body;

  if (!symbol || !name || !description) {
    throw new ValidationError('Symbol, name, and description are required');
  }

  const [newSymbol] = await db('chart_symbols')
    .insert({
      symbol,
      name,
      description,
      color,
      category: category || 'custom',
      is_custom: true,
      user_id: userId,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returning('*');

  await createAuditLog(req, {
    userId,
    action: 'symbol_created',
    entityType: 'chart_symbol',
    entityId: newSymbol.id,
    newValues: newSymbol,
  });

  res.status(201).json({
    success: true,
    message: 'Symbol created successfully',
    data: { symbol: newSymbol },
  });
}
