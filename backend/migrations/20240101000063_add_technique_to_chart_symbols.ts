import type { Knex } from 'knex';

/**
 * Add a `techniques` text[] column to `chart_symbol_templates` so the
 * symbol palette + chart engine can filter at the database layer rather
 * than relying on the client-side category mapping in
 * `frontend/src/utils/techniqueRules.ts`.
 *
 * `techniques` is an array because many symbols belong to several
 * techniques (a basic stockinette knit applies to standard, lace,
 * cables, colorwork, and tapestry). NULL/empty means "applies to every
 * technique for this craft" — the safe default for legacy custom
 * symbols a knitter created before this column existed.
 *
 * Backfill maps each known category to its set of techniques using the
 * same rules the frontend `techniqueRules.ts` engine uses, so the
 * server filter and the client filter agree by construction. Custom
 * symbols (is_system = false) are left as NULL so they always show up
 * regardless of the active technique.
 *
 * Knex JSONB-array migration patterns from feedback memory: prefer
 * imperative JS for small tables; the symbol table is < 100 rows so
 * iterating in JS is unambiguous and fast.
 */

const KNIT_CATEGORY_TECHNIQUES: Record<string, string[]> = {
  basic: ['standard', 'lace', 'cables', 'colorwork', 'tapestry'],
  increase: ['standard', 'lace', 'cables', 'colorwork', 'tapestry'],
  decrease: ['standard', 'lace', 'cables', 'colorwork', 'tapestry'],
  cable: ['cables'],
  twist: ['cables'],
  lace: ['lace'],
  colorwork: ['standard', 'colorwork', 'tapestry'],
  // 'special' covers bobbles, popcorn — useful in standard knit
  // patterns (textured stitches) and lace samplers, not technique-locked.
  special: ['standard', 'lace'],
};

const CROCHET_CATEGORY_TECHNIQUES: Record<string, string[]> = {
  basic: ['standard', 'lace', 'cables', 'colorwork', 'tapestry', 'filet', 'tunisian'],
  increase: ['standard', 'lace', 'cables', 'colorwork', 'tapestry'],
  decrease: ['standard', 'lace', 'cables', 'colorwork', 'tapestry'],
  // Front/back post stitches are the crochet "cables" analogue.
  special: ['standard', 'lace', 'cables', 'tunisian'],
  colorwork: ['colorwork', 'tapestry'],
};

interface SymbolRow {
  id: string;
  craft: 'knit' | 'crochet';
  category: string | null;
  is_system: boolean;
}

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('chart_symbol_templates', (t) => {
    t.specificType('techniques', 'text[]').nullable();
    t.index(['techniques'], 'idx_chart_symbol_techniques', 'GIN');
  });

  // Backfill system symbols using the category → techniques map. Custom
  // symbols (is_system = false) are deliberately left as NULL so they
  // always render in any technique context — knitters who hand-rolled
  // a stitch shouldn't have it disappear when they pick a technique.
  const rows: SymbolRow[] = await knex('chart_symbol_templates')
    .select('id', 'craft', 'category', 'is_system')
    .where({ is_system: true });

  for (const row of rows) {
    const map = row.craft === 'crochet' ? CROCHET_CATEGORY_TECHNIQUES : KNIT_CATEGORY_TECHNIQUES;
    const techniques = row.category ? map[row.category] : null;
    if (!techniques || techniques.length === 0) continue;
    await knex('chart_symbol_templates')
      .where({ id: row.id })
      .update({ techniques });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('chart_symbol_templates', (t) => {
    t.dropIndex(['techniques'], 'idx_chart_symbol_techniques');
    t.dropColumn('techniques');
  });
}
