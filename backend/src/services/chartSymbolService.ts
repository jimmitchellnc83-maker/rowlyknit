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

export type Technique =
  | 'standard'
  | 'lace'
  | 'cables'
  | 'colorwork'
  | 'tapestry'
  | 'filet'
  | 'tunisian';

const VALID_TECHNIQUES: Technique[] = [
  'standard',
  'lace',
  'cables',
  'colorwork',
  'tapestry',
  'filet',
  'tunisian',
];

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
  /** Techniques this symbol applies to. NULL = "applies to every
   *  technique for this craft" (typical for user-custom symbols). */
  techniques: Technique[] | null;
  /** The symbol key this stitch swaps to on a mirrored repeat (k2tog →
   *  ssk, etc.). NULL = no directional lean; the mirror pass leaves it
   *  unchanged. Migration #064. */
  mirror_symbol: string | null;
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
  /** Optional technique tags for custom symbols. NULL/omit = applies
   *  to every technique (the safe default). */
  techniques?: Technique[] | null;
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
  techniques?: Technique[] | null;
}

const VALID_CRAFTS: Craft[] = ['knit', 'crochet'];
const MAX_CELL_SPAN = 8;

/**
 * Return system + user-custom symbols, optionally filtered by craft and
 * technique.
 *
 * Technique filter is applied to system symbols only — custom symbols
 * (rows the user created) always show up because they were authored
 * with the user's intent in mind. The system filter uses the JSONB-array
 * `techniques` column populated by migration #063: a row passes the
 * filter when its `techniques` array contains the requested technique
 * OR is NULL/empty (meaning "applies everywhere").
 *
 * "Recent" and "used in current draft" are computed on the client from
 * localStorage and the active chart respectively, so they are not part of
 * the server-side palette.
 */
export const listSymbols = async (
  userId: string,
  opts: { craft?: Craft; technique?: Technique } = {}
): Promise<SymbolPalette> => {
  const baseQuery = db<ChartSymbolTemplate>('chart_symbol_templates').orderBy('symbol');

  const systemQuery = baseQuery.clone().where({ is_system: true }).whereNull('user_id');
  const customQuery = baseQuery.clone().where({ user_id: userId });

  if (opts.craft) {
    systemQuery.andWhere({ craft: opts.craft });
    customQuery.andWhere({ craft: opts.craft });
  }

  if (opts.technique) {
    // System symbols filter on the techniques array. The "applies
    // everywhere" case is a NULL or empty array — we keep those rows
    // so foundational stitches without explicit tags still render.
    systemQuery.andWhere((qb) => {
      qb.whereNull('techniques')
        .orWhereRaw("array_length(techniques, 1) IS NULL")
        .orWhereRaw('? = ANY(techniques)', [opts.technique!]);
    });
    // Custom symbols are never filtered by technique.
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
  if (input.techniques !== undefined && input.techniques !== null) {
    if (!Array.isArray(input.techniques)) {
      throw new ValidationError('techniques must be an array of technique strings');
    }
    for (const t of input.techniques) {
      if (!VALID_TECHNIQUES.includes(t)) {
        throw new ValidationError(`techniques contains invalid value "${t}"`);
      }
    }
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
      techniques: input.techniques ?? null,
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
  if (input.techniques !== undefined) patch.techniques = input.techniques;

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
