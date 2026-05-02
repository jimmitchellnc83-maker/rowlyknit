/**
 * Chart Service
 *
 * CRUD for personal charts in the `charts` table — backs the Session 4
 * chart asset library. Charts persisted here are reusable across designs:
 * a knitter draws a fair-isle motif once, then drops it onto a hat draft,
 * a sweater body, or a yoke band without redrawing.
 *
 * Charts are always scoped to a user. They may optionally reference a
 * project_id or pattern_id (set when saved from inside a project /
 * pattern context); a NULL on both = "library-only" chart.
 */

import db from '../config/database';
import { NotFoundError, ValidationError } from '../utils/errorHandler';

export type ChartSource = 'manual' | 'image_import' | 'duplicate';

export interface ChartCellShape {
  symbolId: string | null;
  colorHex?: string | null;
}

/** Match the frontend's `ChartData` so persisted charts round-trip
 *  every field. The grid is JSON-blobbed into the `grid` JSONB column,
 *  so undeclared fields used to silently survive the round-trip — but
 *  TypeScript would forget they existed once the row was hydrated.
 *  Declaring them here closes that gap. */
export type ChartHighlightColor = 'yellow' | 'orange' | 'green';

export interface ChartRepeatRegionShape {
  /** 0-indexed column boundaries, inclusive on the left, exclusive on
   *  the right. `[2, 6)` means columns 2, 3, 4, 5 are the repeat. */
  startCol: number;
  endCol: number;
  /** Stitch count outside the repeat (the `+ E` in "multiple of N
   *  stitches, plus E"). Optional — defaults to 0 / not surfaced. */
  edgeStitches?: number;
}

export interface ChartGridShape {
  width: number;
  height: number;
  cells: ChartCellShape[];
  workedInRound?: boolean;
  /** Repeat-box bounds — drives the bold border in the renderer and
   *  the cast-on preamble ("multiple of N + E"). */
  repeatRegion?: ChartRepeatRegionShape;
  /** Per-row notes keyed by KNITTER row number (1-indexed from the
   *  bottom). Surfaced alongside the written instructions. */
  rowNotes?: Record<string, string>;
  /** Sparse cell-index → highlight-color map. Translucent overlay drawn
   *  above the symbol layer; doesn't change underlying stitch data. */
  highlights?: Record<string, ChartHighlightColor>;
}

export interface ChartRow {
  id: string;
  user_id: string;
  project_id: string | null;
  pattern_id: string | null;
  name: string;
  grid: ChartGridShape;
  rows: number;
  columns: number;
  symbol_legend: Record<string, unknown>;
  description: string | null;
  source: string;
  source_image_url: string | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ListChartsOpts {
  /** When true, returns archived charts INSTEAD of active ones. Default false. */
  includeArchived?: boolean;
  /** Filter to charts attached to this project. */
  projectId?: string;
  /** Filter to charts attached to this pattern. */
  patternId?: string;
  /** Substring match on name (case-insensitive). */
  query?: string;
  /** Soft pagination — default 50, capped at 200 to keep payloads sane. */
  limit?: number;
  offset?: number;
}

export interface CreateChartInput {
  name: string;
  grid: ChartGridShape;
  description?: string | null;
  project_id?: string | null;
  pattern_id?: string | null;
  source?: ChartSource;
  source_image_url?: string | null;
  symbol_legend?: Record<string, unknown>;
}

export interface UpdateChartInput {
  name?: string;
  grid?: ChartGridShape;
  description?: string | null;
  project_id?: string | null;
  pattern_id?: string | null;
  symbol_legend?: Record<string, unknown>;
}

const MAX_NAME_LENGTH = 255;
const MAX_GRID_CELLS = 60 * 60;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const validateGrid = (grid: ChartGridShape): void => {
  if (!grid || typeof grid !== 'object') {
    throw new ValidationError('grid is required');
  }
  if (!Number.isInteger(grid.width) || grid.width < 1 || grid.width > 60) {
    throw new ValidationError('grid.width must be an integer 1-60');
  }
  if (!Number.isInteger(grid.height) || grid.height < 1 || grid.height > 60) {
    throw new ValidationError('grid.height must be an integer 1-60');
  }
  if (!Array.isArray(grid.cells)) {
    throw new ValidationError('grid.cells must be an array');
  }
  if (grid.cells.length !== grid.width * grid.height) {
    throw new ValidationError(
      `grid.cells length (${grid.cells.length}) must equal width × height (${grid.width * grid.height})`,
    );
  }
  if (grid.cells.length > MAX_GRID_CELLS) {
    throw new ValidationError(`grid is larger than the ${MAX_GRID_CELLS}-cell maximum`);
  }
};

const validateName = (name: string | undefined, required: boolean): void => {
  if (required && (!name || name.trim().length === 0)) {
    throw new ValidationError('name is required');
  }
  if (name !== undefined && name.length > MAX_NAME_LENGTH) {
    throw new ValidationError(`name must be ${MAX_NAME_LENGTH} characters or fewer`);
  }
};

const parseGridColumn = (raw: unknown): ChartGridShape => {
  if (!raw) return { width: 0, height: 0, cells: [] };
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed as ChartGridShape;
    } catch {
      return { width: 0, height: 0, cells: [] };
    }
  }
  return raw as ChartGridShape;
};

const hydrate = (row: any): ChartRow => ({
  ...row,
  grid: parseGridColumn(row.grid),
  symbol_legend:
    typeof row.symbol_legend === 'string'
      ? JSON.parse(row.symbol_legend || '{}')
      : row.symbol_legend ?? {},
});

/**
 * List a user's charts. Filters by archive state, optional project /
 * pattern attachment, and an optional name substring. Always scoped to
 * `user_id` — no cross-user visibility.
 */
export const listCharts = async (
  userId: string,
  opts: ListChartsOpts = {},
): Promise<{ charts: ChartRow[]; total: number }> => {
  const limit = Math.min(opts.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
  const offset = Math.max(opts.offset ?? 0, 0);

  let query = db('charts').where({ user_id: userId });
  if (opts.includeArchived) {
    query = query.whereNotNull('archived_at');
  } else {
    query = query.whereNull('archived_at');
  }
  if (opts.projectId) query = query.andWhere({ project_id: opts.projectId });
  if (opts.patternId) query = query.andWhere({ pattern_id: opts.patternId });
  if (opts.query && opts.query.trim()) {
    query = query.andWhereILike('name', `%${opts.query.trim()}%`);
  }

  const [{ count }] = (await query
    .clone()
    .clearSelect()
    .clearOrder()
    .count<{ count: string }[]>('id as count')) as Array<{ count: string }>;

  const rows = await query
    .orderBy('updated_at', 'desc')
    .limit(limit)
    .offset(offset);

  return {
    charts: rows.map(hydrate),
    total: Number(count),
  };
};

export const getChart = async (chartId: string, userId: string): Promise<ChartRow> => {
  const row = await db('charts').where({ id: chartId, user_id: userId }).first();
  if (!row) throw new NotFoundError('Chart not found');
  return hydrate(row);
};

export const createChart = async (
  userId: string,
  input: CreateChartInput,
): Promise<ChartRow> => {
  validateName(input.name, true);
  validateGrid(input.grid);

  const [created] = await db('charts')
    .insert({
      user_id: userId,
      project_id: input.project_id ?? null,
      pattern_id: input.pattern_id ?? null,
      name: input.name.trim(),
      grid: JSON.stringify(input.grid),
      rows: input.grid.height,
      columns: input.grid.width,
      symbol_legend: JSON.stringify(input.symbol_legend ?? {}),
      description: input.description ?? null,
      source: input.source ?? 'manual',
      source_image_url: input.source_image_url ?? null,
    })
    .returning('*');

  return hydrate(created);
};

export const updateChart = async (
  chartId: string,
  userId: string,
  input: UpdateChartInput,
): Promise<ChartRow> => {
  validateName(input.name, false);
  if (input.grid !== undefined) validateGrid(input.grid);

  const existing = await db('charts').where({ id: chartId, user_id: userId }).first();
  if (!existing) throw new NotFoundError('Chart not found');

  const patch: Record<string, unknown> = { updated_at: db.fn.now() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description;
  if (input.project_id !== undefined) patch.project_id = input.project_id;
  if (input.pattern_id !== undefined) patch.pattern_id = input.pattern_id;
  if (input.symbol_legend !== undefined) {
    patch.symbol_legend = JSON.stringify(input.symbol_legend);
  }
  if (input.grid !== undefined) {
    patch.grid = JSON.stringify(input.grid);
    patch.rows = input.grid.height;
    patch.columns = input.grid.width;
  }

  const [updated] = await db('charts')
    .where({ id: chartId, user_id: userId })
    .update(patch)
    .returning('*');

  return hydrate(updated);
};

/**
 * Soft-archive: charts with `archived_at` set are hidden from the
 * default list view but kept in the database for restore. Idempotent —
 * archiving an already-archived chart is a no-op.
 */
export const archiveChart = async (chartId: string, userId: string): Promise<ChartRow> => {
  const existing = await db('charts').where({ id: chartId, user_id: userId }).first();
  if (!existing) throw new NotFoundError('Chart not found');
  if (existing.archived_at) return hydrate(existing);

  const [updated] = await db('charts')
    .where({ id: chartId, user_id: userId })
    .update({ archived_at: db.fn.now(), updated_at: db.fn.now() })
    .returning('*');

  return hydrate(updated);
};

export const restoreChart = async (chartId: string, userId: string): Promise<ChartRow> => {
  const existing = await db('charts').where({ id: chartId, user_id: userId }).first();
  if (!existing) throw new NotFoundError('Chart not found');
  if (!existing.archived_at) return hydrate(existing);

  const [updated] = await db('charts')
    .where({ id: chartId, user_id: userId })
    .update({ archived_at: null, updated_at: db.fn.now() })
    .returning('*');

  return hydrate(updated);
};

/**
 * Hard delete. Generally prefer archiveChart in user-facing flows; this
 * is the irreversible escape hatch for cases where the user wants the
 * row gone (e.g. it contained sensitive content).
 */
export const deleteChart = async (chartId: string, userId: string): Promise<void> => {
  const existing = await db('charts').where({ id: chartId, user_id: userId }).first();
  if (!existing) throw new NotFoundError('Chart not found');
  await db('charts').where({ id: chartId, user_id: userId }).delete();
};

/**
 * Duplicate a chart. The copy is unattached to project / pattern (so it
 * lives in the library) and gets a "(copy)" suffix on its name.
 */
export const duplicateChart = async (
  chartId: string,
  userId: string,
): Promise<ChartRow> => {
  const source = await getChart(chartId, userId);
  const newName =
    source.name.endsWith('(copy)') || /\(copy \d+\)$/.test(source.name)
      ? `${source.name.replace(/\s*\(copy(?:\s+\d+)?\)$/, '')} (copy)`
      : `${source.name} (copy)`;
  const truncated = newName.length > MAX_NAME_LENGTH ? newName.slice(0, MAX_NAME_LENGTH) : newName;

  const [created] = await db('charts')
    .insert({
      user_id: userId,
      project_id: null,
      pattern_id: null,
      name: truncated,
      grid: JSON.stringify(source.grid),
      rows: source.rows,
      columns: source.columns,
      symbol_legend: JSON.stringify(source.symbol_legend ?? {}),
      description: source.description,
      source: 'duplicate',
      source_image_url: null,
    })
    .returning('*');

  return hydrate(created);
};
