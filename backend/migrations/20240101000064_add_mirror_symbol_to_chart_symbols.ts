import type { Knex } from 'knex';

/**
 * Add a `mirror_symbol` text column to `chart_symbol_templates` so the
 * repeat engine's mirrored block can swap symbols with directional
 * lean (k2tog ↔ ssk) instead of just reversing token order.
 *
 * PR 3 of the Designer rebuild shipped *structural* mirror only —
 * `MirroredRepeatBlock` reverses the order of tokens in the body but
 * the symbols themselves stay the same. That's correct for symbols
 * with no lean (k, p, yo) and visually wrong for paired
 * decreases/increases/twists.
 *
 * This column lets `repeatEngine` consult the symbol palette and emit
 * `ssk` where the forward pass had `k2tog`, etc. NULL means "this
 * symbol has no mirror counterpart" — the engine leaves it as-is on
 * the mirror pass.
 *
 * Backfill seeds the well-known knit pairs:
 *   k2tog ↔ ssk
 *   /     ↔ \      (chart-glyph aliases of k2tog/ssk)
 *   p2tog ↔ ssp
 *   t2r   ↔ t2l
 *   rt    ↔ lt
 *   inc-r ↔ inc-l
 *   c6f   ↔ c6b    (cable cross direction)
 *
 * Custom symbols stay NULL — knitters who hand-rolled a stitch shouldn't
 * find it silently swapped on a mirror pass.
 *
 * Knex JSONB-array migration patterns from feedback memory: prefer
 * imperative JS for small tables; symbol templates are < 100 rows.
 */

const MIRROR_PAIRS: Array<[string, string]> = [
  ['k2tog', 'ssk'],
  ['/', '\\'],
  ['p2tog', 'ssp'],
  ['t2r', 't2l'],
  ['rt', 'lt'],
  ['inc-r', 'inc-l'],
  ['c6f', 'c6b'],
];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('chart_symbol_templates', (t) => {
    t.string('mirror_symbol').nullable();
  });

  // Apply each pair in both directions so a forward k2tog → mirror ssk
  // *and* a forward ssk → mirror k2tog (a row that starts with ssk
  // mirrors to one that ends with k2tog). The engine reads
  // mirror_symbol as a one-way lookup; keying both sides is the
  // simplest safe representation.
  for (const [a, b] of MIRROR_PAIRS) {
    await knex('chart_symbol_templates')
      .where({ symbol: a, is_system: true })
      .update({ mirror_symbol: b });
    await knex('chart_symbol_templates')
      .where({ symbol: b, is_system: true })
      .update({ mirror_symbol: a });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('chart_symbol_templates', (t) => {
    t.dropColumn('mirror_symbol');
  });
}
