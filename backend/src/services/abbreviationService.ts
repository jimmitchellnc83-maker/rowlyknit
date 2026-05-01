/**
 * Abbreviation glossary service.
 *
 * Read-only listing + search over the canonical CYC abbreviation list
 * seeded by migration #068. The same data backs:
 *   - the public `/help/glossary` surface (no auth, rate-limited via
 *     `/shared/glossary` route),
 *   - the in-app glossary surfaced from the chart palette popover.
 *
 * No write APIs yet — user-custom abbreviations are scaffolded in the
 * schema (`is_system=false` + `user_id`) but no UI exposes them.
 */

import db from '../config/database';

export type Craft = 'knit' | 'crochet' | 'tunisian' | 'loom-knit';

export const VALID_CRAFTS: Craft[] = ['knit', 'crochet', 'tunisian', 'loom-knit'];

export interface Abbreviation {
  id: string;
  abbreviation: string;
  expansion: string;
  description: string | null;
  craft: Craft;
  category: string;
  is_system: boolean;
  user_id: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface ListOptions {
  craft?: Craft;
  category?: string;
  /**
   * Free-text search — case-insensitive substring match against the
   * `abbreviation`, `expansion`, and `description` columns. Trimmed; an
   * empty/whitespace string is treated as no filter.
   */
  search?: string;
  /**
   * When supplied, return user-custom rows for this user (`user_id = userId`)
   * in addition to the system rows. Omit to return system rows only.
   */
  userId?: string;
}

export interface CategoryCount {
  category: string;
  count: number;
}

const escapeLike = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

/**
 * List abbreviations, optionally filtered by craft / category / search.
 *
 * Sorted by (craft, category, lower(abbreviation)) for stable pagination
 * and a humane default order in the glossary UI.
 */
export const listAbbreviations = async (
  opts: ListOptions = {}
): Promise<Abbreviation[]> => {
  const query = db<Abbreviation>('abbreviations')
    .orderBy('craft')
    .orderBy('category')
    .orderByRaw('LOWER(abbreviation) ASC');

  if (opts.userId) {
    query.where((qb) => {
      qb.where({ is_system: true }).whereNull('user_id');
      qb.orWhere({ user_id: opts.userId });
    });
  } else {
    query.where({ is_system: true }).whereNull('user_id');
  }

  if (opts.craft) {
    query.andWhere({ craft: opts.craft });
  }
  if (opts.category) {
    query.andWhere({ category: opts.category });
  }
  if (opts.search) {
    const trimmed = opts.search.trim();
    if (trimmed.length > 0) {
      const needle = `%${escapeLike(trimmed)}%`;
      query.andWhere((qb) => {
        qb.whereRaw('abbreviation ILIKE ?', [needle])
          .orWhereRaw('expansion ILIKE ?', [needle])
          .orWhereRaw('description ILIKE ?', [needle]);
      });
    }
  }

  return query;
};

/**
 * Look up a single abbreviation by exact `abbreviation` + `craft` (system
 * row). Used for deep-linking from the chart palette popover. Returns
 * NULL when no match — case-sensitive lookup since `BO` ≠ `bo`.
 */
export const lookupAbbreviation = async (
  abbreviation: string,
  craft: Craft
): Promise<Abbreviation | null> => {
  const row = await db<Abbreviation>('abbreviations')
    .where({ abbreviation, craft, is_system: true })
    .whereNull('user_id')
    .first();
  return row ?? null;
};

/**
 * Aggregate count of system rows by category for a craft. Used by the
 * glossary UI to render filter chips with counts ("Stitches (28)").
 */
export const categoryCounts = async (craft?: Craft): Promise<CategoryCount[]> => {
  const query = db('abbreviations')
    .select('category')
    .count<{ category: string; count: string }[]>('* as count')
    .where({ is_system: true })
    .whereNull('user_id')
    .groupBy('category')
    .orderBy('category');
  if (craft) query.andWhere({ craft });
  const rows = await query;
  return rows.map((r) => ({ category: r.category, count: Number(r.count) }));
};

export const isCraft = (value: unknown): value is Craft =>
  typeof value === 'string' && (VALID_CRAFTS as string[]).includes(value);
