/**
 * Chart Symbol Service
 *
 * CRUD + palette grouping for `chart_symbol_templates`. Backs the Designer's
 * stitch palette (system + user-custom) and feeds the chart-to-text engine
 * with abbreviation / RS / WS / cell-span data.
 */

import db from '../config/database';
import { ConflictError, NotFoundError, ValidationError } from '../utils/errorHandler';

export type Craft = 'knit' | 'crochet';

export interface ChartSymbolTemplate {
  id: string;
  symbol: string;
  name: string;
  category: string | null;
  description: string | null;
  variations: unknown;
  is_system: boolean;
  user_id: string | null;
  abbreviation: string | null;
  rs_instruction: string | null;
  ws_instruction: string | null;
  cell_span: number;
  craft: Craft;
  created_at: Date;
}

export interface SymbolPalette {
  system: ChartSymbolTemplate[];
  custom: ChartSymbolTemplate[];
}

export interface CreateSymbolInput {
  symbol: string;
  name: string;
  category?: string | null;
  description?: string | null;
  abbreviation?: string | null;
  rs_instruction?: string | null;
  ws_instruction?: string | null;
  cell_span?: number;
  craft?: Craft;
}

export interface UpdateSymbolInput {
  name?: string;
  category?: string | null;
  description?: string | null;
  abbreviation?: string | null;
  rs_instruction?: string | null;
  ws_instruction?: string | null;
  cell_span?: number;
  craft?: Craft;
}

const VALID_CRAFTS: Craft[] = ['knit', 'crochet'];
const MAX_CELL_SPAN = 8;

/**
 * Return system + user-custom symbols, optionally filtered by craft.
 *
 * "Recent" and "used in current draft" are computed on the client from
 * localStorage and the active chart respectively, so they are not part of
 * the server-side palette.
 */
export const listSymbols = async (
  userId: string,
  opts: { craft?: Craft } = {}
): Promise<SymbolPalette> => {
  const baseQuery = db<ChartSymbolTemplate>('chart_symbol_templates').orderBy('symbol');

  const systemQuery = baseQuery.clone().where({ is_system: true }).whereNull('user_id');
  const customQuery = baseQuery.clone().where({ user_id: userId });

  if (opts.craft) {
    systemQuery.andWhere({ craft: opts.craft });
    customQuery.andWhere({ craft: opts.craft });
  }

  const [system, custom] = await Promise.all([systemQuery, customQuery]);
  return { system, custom };
};

/**
 * Look up a list of symbols by their `symbol` keys (used by the chart-to-text
 * engine + glossary auto-generation to resolve every symbol used in a chart).
 */
export const lookupSymbols = async (
  userId: string,
  symbols: string[]
): Promise<ChartSymbolTemplate[]> => {
  if (symbols.length === 0) return [];

  // System rows (user_id IS NULL) are visible to everyone; custom rows are
  // visible only to their owner.
  return db<ChartSymbolTemplate>('chart_symbol_templates')
    .whereIn('symbol', symbols)
    .andWhere((qb) => {
      qb.whereNull('user_id').orWhere({ user_id: userId });
    });
};

const validateInput = (
  input: CreateSymbolInput | UpdateSymbolInput,
  required: boolean
): void => {
  if (required) {
    const create = input as CreateSymbolInput;
    if (!create.symbol || create.symbol.trim().length === 0) {
      throw new ValidationError('symbol is required');
    }
    if (create.symbol.length > 10) {
      throw new ValidationError('symbol must be 10 characters or fewer');
    }
    if (!create.name || create.name.trim().length === 0) {
      throw new ValidationError('name is required');
    }
  }

  if (input.name !== undefined && input.name.length > 100) {
    throw new ValidationError('name must be 100 characters or fewer');
  }
  if (
    input.abbreviation !== undefined &&
    input.abbreviation !== null &&
    input.abbreviation.length > 20
  ) {
    throw new ValidationError('abbreviation must be 20 characters or fewer');
  }
  if (input.cell_span !== undefined) {
    if (!Number.isInteger(input.cell_span) || input.cell_span < 1 || input.cell_span > MAX_CELL_SPAN) {
      throw new ValidationError(`cell_span must be an integer 1-${MAX_CELL_SPAN}`);
    }
  }
  if (input.craft !== undefined && !VALID_CRAFTS.includes(input.craft)) {
    throw new ValidationError(`craft must be one of: ${VALID_CRAFTS.join(', ')}`);
  }
};

/**
 * Create a user-custom stitch.
 *
 * The (symbol, user_id) pair is unique. A user cannot reuse a symbol that
 * collides with one of their own custom symbols, but they may use a symbol
 * string that already exists as a system symbol — the system row has
 * user_id = NULL so the unique constraint does not collide.
 */
export const createCustomSymbol = async (
  userId: string,
  input: CreateSymbolInput
): Promise<ChartSymbolTemplate> => {
  validateInput(input, true);

  const existing = await db<ChartSymbolTemplate>('chart_symbol_templates')
    .where({ symbol: input.symbol, user_id: userId })
    .first();

  if (existing) {
    throw new ConflictError(`You already have a custom stitch with symbol "${input.symbol}"`);
  }

  const [created] = await db<ChartSymbolTemplate>('chart_symbol_templates')
    .insert({
      symbol: input.symbol.trim(),
      name: input.name.trim(),
      category: input.category ?? null,
      description: input.description ?? null,
      abbreviation: input.abbreviation ?? null,
      rs_instruction: input.rs_instruction ?? null,
      ws_instruction: input.ws_instruction ?? null,
      cell_span: input.cell_span ?? 1,
      craft: input.craft ?? 'knit',
      is_system: false,
      user_id: userId,
    })
    .returning('*');

  return created;
};

/**
 * Update a user-custom stitch. System stitches cannot be edited.
 */
export const updateCustomSymbol = async (
  symbolId: string,
  userId: string,
  input: UpdateSymbolInput
): Promise<ChartSymbolTemplate> => {
  validateInput(input, false);

  const existing = await db<ChartSymbolTemplate>('chart_symbol_templates')
    .where({ id: symbolId })
    .first();

  if (!existing) {
    throw new NotFoundError('Stitch not found');
  }
  if (existing.is_system || existing.user_id !== userId) {
    throw new NotFoundError('Stitch not found');
  }

  const patch: Partial<ChartSymbolTemplate> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.category !== undefined) patch.category = input.category;
  if (input.description !== undefined) patch.description = input.description;
  if (input.abbreviation !== undefined) patch.abbreviation = input.abbreviation;
  if (input.rs_instruction !== undefined) patch.rs_instruction = input.rs_instruction;
  if (input.ws_instruction !== undefined) patch.ws_instruction = input.ws_instruction;
  if (input.cell_span !== undefined) patch.cell_span = input.cell_span;
  if (input.craft !== undefined) patch.craft = input.craft;

  if (Object.keys(patch).length === 0) {
    return existing;
  }

  const [updated] = await db<ChartSymbolTemplate>('chart_symbol_templates')
    .where({ id: symbolId, user_id: userId })
    .update(patch)
    .returning('*');

  return updated;
};

/**
 * Delete a user-custom stitch. System stitches cannot be deleted.
 *
 * Hard delete: chart cells store symbol strings, not FKs, so old charts will
 * just render the symbol as unknown. The Designer UI warns about this.
 */
export const deleteCustomSymbol = async (
  symbolId: string,
  userId: string
): Promise<void> => {
  const existing = await db<ChartSymbolTemplate>('chart_symbol_templates')
    .where({ id: symbolId })
    .first();

  if (!existing) {
    throw new NotFoundError('Stitch not found');
  }
  if (existing.is_system || existing.user_id !== userId) {
    throw new NotFoundError('Stitch not found');
  }

  await db('chart_symbol_templates').where({ id: symbolId, user_id: userId }).delete();
};
