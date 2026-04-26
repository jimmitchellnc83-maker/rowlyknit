import { Knex } from 'knex';

/**
 * Migration 058: expand chart_symbol_templates for chart-to-text + crochet.
 *
 * Adds five columns and seeds knit backfill + a crochet system palette so
 * downstream work (chart-to-text engine, glossary auto-generation, custom
 * stitch authoring UI) has structured data to read.
 *
 *   abbreviation     — short form used in written instructions ("k", "k2tog")
 *   rs_instruction   — RS-row text for chart-to-text ("k1", "yo", "ssk")
 *   ws_instruction   — WS-row text; NULL = stitch is RS-only (e.g. cables)
 *   cell_span        — 4 for c4f, 6 for c6b, etc. Default 1.
 *   craft            — 'knit' or 'crochet'. Default 'knit'.
 */

interface KnitBackfill {
  symbol: string;
  abbreviation: string | null;
  rs_instruction: string | null;
  ws_instruction: string | null;
  cell_span: number;
}

const KNIT_BACKFILL: KnitBackfill[] = [
  { symbol: 'k', abbreviation: 'k', rs_instruction: 'k1', ws_instruction: 'p1', cell_span: 1 },
  { symbol: 'p', abbreviation: 'p', rs_instruction: 'p1', ws_instruction: 'k1', cell_span: 1 },
  { symbol: '.', abbreviation: 'k', rs_instruction: 'k1', ws_instruction: 'p1', cell_span: 1 },
  { symbol: '-', abbreviation: 'p', rs_instruction: 'p1', ws_instruction: 'k1', cell_span: 1 },
  { symbol: 'yo', abbreviation: 'yo', rs_instruction: 'yo', ws_instruction: 'yo', cell_span: 1 },
  { symbol: 'o', abbreviation: 'yo', rs_instruction: 'yo', ws_instruction: 'yo', cell_span: 1 },
  { symbol: 'k2tog', abbreviation: 'k2tog', rs_instruction: 'k2tog', ws_instruction: 'p2tog tbl', cell_span: 1 },
  { symbol: '/', abbreviation: 'k2tog', rs_instruction: 'k2tog', ws_instruction: 'p2tog tbl', cell_span: 1 },
  { symbol: 'ssk', abbreviation: 'ssk', rs_instruction: 'ssk', ws_instruction: 'p2tog', cell_span: 1 },
  { symbol: '\\', abbreviation: 'ssk', rs_instruction: 'ssk', ws_instruction: 'p2tog', cell_span: 1 },
  { symbol: 'sl', abbreviation: 'sl', rs_instruction: 'sl 1 wyib', ws_instruction: 'sl 1 wyif', cell_span: 1 },
  { symbol: 'v', abbreviation: 'sl', rs_instruction: 'sl 1 wyib', ws_instruction: 'sl 1 wyif', cell_span: 1 },
  { symbol: 'm1l', abbreviation: 'M1L', rs_instruction: 'M1L', ws_instruction: null, cell_span: 1 },
  { symbol: 'm1r', abbreviation: 'M1R', rs_instruction: 'M1R', ws_instruction: null, cell_span: 1 },
  { symbol: 'kfb', abbreviation: 'kfb', rs_instruction: 'kfb', ws_instruction: null, cell_span: 1 },
  { symbol: 'pfb', abbreviation: 'pfb', rs_instruction: null, ws_instruction: 'pfb', cell_span: 1 },
  { symbol: 'c4f', abbreviation: 'C4F', rs_instruction: 'sl 2 to cn, hold front, k2, k2 from cn', ws_instruction: null, cell_span: 4 },
  { symbol: 'c4b', abbreviation: 'C4B', rs_instruction: 'sl 2 to cn, hold back, k2, k2 from cn', ws_instruction: null, cell_span: 4 },
  { symbol: 'c6f', abbreviation: 'C6F', rs_instruction: 'sl 3 to cn, hold front, k3, k3 from cn', ws_instruction: null, cell_span: 6 },
  { symbol: 'c6b', abbreviation: 'C6B', rs_instruction: 'sl 3 to cn, hold back, k3, k3 from cn', ws_instruction: null, cell_span: 6 },
  { symbol: 'x', abbreviation: null, rs_instruction: null, ws_instruction: null, cell_span: 1 },
  { symbol: '[]', abbreviation: null, rs_instruction: null, ws_instruction: null, cell_span: 1 },
  { symbol: 'yo2', abbreviation: 'yo2', rs_instruction: '(yo) twice', ws_instruction: '(yo) twice', cell_span: 1 },
  { symbol: 't2r', abbreviation: 'T2R', rs_instruction: 'k second st in front of first, then k first st, slip both off', ws_instruction: null, cell_span: 2 },
  { symbol: 't2l', abbreviation: 'T2L', rs_instruction: 'k second st through back loop, then k first st, slip both off', ws_instruction: null, cell_span: 2 },
  { symbol: 'rt', abbreviation: 'RT', rs_instruction: 'k2tog leaving on left needle, k first st again, slip both off', ws_instruction: null, cell_span: 2 },
  { symbol: 'lt', abbreviation: 'LT', rs_instruction: 'k second st tbl, then k first st, slip both off', ws_instruction: null, cell_span: 2 },
  { symbol: 'bobble', abbreviation: 'MB', rs_instruction: 'make bobble (kfbf in next st, turn, p5, turn, k5, pass 4 sts over 1st)', ws_instruction: null, cell_span: 1 },
  { symbol: 'popcorn', abbreviation: 'PC', rs_instruction: 'popcorn (5 sts in next st, turn, p5, turn, k5, pass 4 sts over 1st)', ws_instruction: null, cell_span: 1 },
  { symbol: 'seed', abbreviation: 'seed', rs_instruction: 'work in seed st', ws_instruction: 'work in seed st', cell_span: 1 },
  { symbol: 'mc', abbreviation: 'MC', rs_instruction: 'k1 with MC', ws_instruction: 'p1 with MC', cell_span: 1 },
  { symbol: 'cc', abbreviation: 'CC', rs_instruction: 'k1 with CC', ws_instruction: 'p1 with CC', cell_span: 1 },
  { symbol: 'inc-r', abbreviation: 'RLI', rs_instruction: 'right lifted increase', ws_instruction: null, cell_span: 1 },
  { symbol: 'inc-l', abbreviation: 'LLI', rs_instruction: 'left lifted increase', ws_instruction: null, cell_span: 1 },
  { symbol: 'p2tog', abbreviation: 'p2tog', rs_instruction: 'p2tog', ws_instruction: 'k2tog', cell_span: 1 },
  { symbol: 'ssp', abbreviation: 'ssp', rs_instruction: 'ssp', ws_instruction: 'k2tog tbl', cell_span: 1 },
];

interface CrochetSeed {
  symbol: string;
  name: string;
  category: string;
  description: string;
  abbreviation: string;
  rs_instruction: string;
  ws_instruction: string | null;
  cell_span: number;
}

const CROCHET_SEEDS: CrochetSeed[] = [
  { symbol: 'ch', name: 'Chain', category: 'basic', description: 'Foundation chain stitch', abbreviation: 'ch', rs_instruction: 'ch 1', ws_instruction: 'ch 1', cell_span: 1 },
  { symbol: 'sl-st', name: 'Slip Stitch', category: 'basic', description: 'Slip stitch — used to join, travel, and finish edges', abbreviation: 'sl st', rs_instruction: 'sl st', ws_instruction: 'sl st', cell_span: 1 },
  { symbol: 'sc', name: 'Single Crochet', category: 'basic', description: 'Single crochet (US) / double crochet (UK)', abbreviation: 'sc', rs_instruction: 'sc', ws_instruction: 'sc', cell_span: 1 },
  { symbol: 'hdc', name: 'Half Double Crochet', category: 'basic', description: 'Half double crochet — between sc and dc in height', abbreviation: 'hdc', rs_instruction: 'hdc', ws_instruction: 'hdc', cell_span: 1 },
  { symbol: 'dc', name: 'Double Crochet', category: 'basic', description: 'Double crochet (US) / treble crochet (UK)', abbreviation: 'dc', rs_instruction: 'dc', ws_instruction: 'dc', cell_span: 1 },
  { symbol: 'tr', name: 'Treble Crochet', category: 'basic', description: 'Treble crochet — taller than dc', abbreviation: 'tr', rs_instruction: 'tr', ws_instruction: 'tr', cell_span: 1 },
  { symbol: 'dtr', name: 'Double Treble', category: 'basic', description: 'Double treble — four yarn-overs', abbreviation: 'dtr', rs_instruction: 'dtr', ws_instruction: 'dtr', cell_span: 1 },
  { symbol: 'sc-inc', name: 'SC Increase', category: 'increase', description: 'Two single crochets in same stitch', abbreviation: 'sc inc', rs_instruction: '2 sc in next st', ws_instruction: '2 sc in next st', cell_span: 1 },
  { symbol: 'hdc-inc', name: 'HDC Increase', category: 'increase', description: 'Two half doubles in same stitch', abbreviation: 'hdc inc', rs_instruction: '2 hdc in next st', ws_instruction: '2 hdc in next st', cell_span: 1 },
  { symbol: 'dc-inc', name: 'DC Increase', category: 'increase', description: 'Two double crochets in same stitch', abbreviation: 'dc inc', rs_instruction: '2 dc in next st', ws_instruction: '2 dc in next st', cell_span: 1 },
  { symbol: 'sc2tog', name: 'SC Decrease', category: 'decrease', description: 'Single crochet two together (invisible decrease)', abbreviation: 'sc2tog', rs_instruction: 'sc2tog', ws_instruction: 'sc2tog', cell_span: 1 },
  { symbol: 'hdc2tog', name: 'HDC Decrease', category: 'decrease', description: 'Half double crochet two together', abbreviation: 'hdc2tog', rs_instruction: 'hdc2tog', ws_instruction: 'hdc2tog', cell_span: 1 },
  { symbol: 'dc2tog', name: 'DC Decrease', category: 'decrease', description: 'Double crochet two together', abbreviation: 'dc2tog', rs_instruction: 'dc2tog', ws_instruction: 'dc2tog', cell_span: 1 },
  { symbol: 'fpdc', name: 'Front Post DC', category: 'special', description: 'Front post double crochet — creates raised vertical texture', abbreviation: 'FPdc', rs_instruction: 'FPdc', ws_instruction: 'BPdc', cell_span: 1 },
  { symbol: 'bpdc', name: 'Back Post DC', category: 'special', description: 'Back post double crochet — recessed vertical texture', abbreviation: 'BPdc', rs_instruction: 'BPdc', ws_instruction: 'FPdc', cell_span: 1 },
  { symbol: 'fpsc', name: 'Front Post SC', category: 'special', description: 'Front post single crochet', abbreviation: 'FPsc', rs_instruction: 'FPsc', ws_instruction: 'BPsc', cell_span: 1 },
  { symbol: 'bpsc', name: 'Back Post SC', category: 'special', description: 'Back post single crochet', abbreviation: 'BPsc', rs_instruction: 'BPsc', ws_instruction: 'FPsc', cell_span: 1 },
  { symbol: 'shell', name: 'Shell', category: 'special', description: 'Shell stitch — multiple dc in one stitch', abbreviation: 'shell', rs_instruction: 'shell (5 dc) in next st', ws_instruction: 'shell (5 dc) in next st', cell_span: 5 },
  { symbol: 'v-st', name: 'V-Stitch', category: 'special', description: 'V-stitch — dc, ch 1, dc in one stitch', abbreviation: 'V-st', rs_instruction: '(dc, ch 1, dc) in next st', ws_instruction: '(dc, ch 1, dc) in next st', cell_span: 1 },
  { symbol: 'cl', name: 'Cluster', category: 'special', description: 'Cluster — multiple partial stitches joined at top', abbreviation: 'cl', rs_instruction: '3-dc cluster in next st', ws_instruction: '3-dc cluster in next st', cell_span: 1 },
  { symbol: 'pc', name: 'Popcorn (Crochet)', category: 'special', description: 'Crochet popcorn — 5 dc joined into raised bobble', abbreviation: 'pop', rs_instruction: '5-dc popcorn in next st', ws_instruction: null, cell_span: 1 },
  { symbol: 'puff', name: 'Puff Stitch', category: 'special', description: 'Puff stitch — multiple yarn-overs pulled through', abbreviation: 'puff', rs_instruction: 'puff stitch in next st', ws_instruction: null, cell_span: 1 },
  { symbol: 'picot', name: 'Picot', category: 'special', description: 'Picot — chain loop locked with slip stitch', abbreviation: 'picot', rs_instruction: 'ch 3, sl st in 3rd ch from hook', ws_instruction: 'ch 3, sl st in 3rd ch from hook', cell_span: 1 },
  { symbol: 'mr', name: 'Magic Ring', category: 'placeholder', description: 'Magic ring / adjustable ring start', abbreviation: 'MR', rs_instruction: 'magic ring', ws_instruction: null, cell_span: 1 },
  { symbol: 'ch-sp', name: 'Chain Space', category: 'placeholder', description: 'Skip-over chain space from prior row', abbreviation: 'ch-sp', rs_instruction: 'work in ch-sp', ws_instruction: 'work in ch-sp', cell_span: 1 },
  { symbol: 'rev-sc', name: 'Reverse SC (Crab Stitch)', category: 'special', description: 'Reverse single crochet — worked left to right for a corded edge', abbreviation: 'rev sc', rs_instruction: 'reverse sc', ws_instruction: null, cell_span: 1 },
];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('chart_symbol_templates', (table) => {
    table.string('abbreviation', 20).nullable();
    table.text('rs_instruction').nullable();
    table.text('ws_instruction').nullable();
    table.integer('cell_span').notNullable().defaultTo(1);
    table.string('craft', 10).notNullable().defaultTo('knit');
  });

  await knex.raw(
    `ALTER TABLE chart_symbol_templates
       ADD CONSTRAINT chart_symbol_templates_craft_check
       CHECK (craft IN ('knit', 'crochet'))`
  );

  await knex.schema.alterTable('chart_symbol_templates', (table) => {
    table.index('craft', 'idx_symbol_templates_craft');
  });

  // Backfill knit system stitches with abbreviation/RS/WS/cell_span values.
  for (const row of KNIT_BACKFILL) {
    await knex('chart_symbol_templates')
      .where({ symbol: row.symbol, is_system: true })
      .whereNull('user_id')
      .update({
        abbreviation: row.abbreviation,
        rs_instruction: row.rs_instruction,
        ws_instruction: row.ws_instruction,
        cell_span: row.cell_span,
        craft: 'knit',
      });
  }

  // Seed crochet system stitches. Skip rows that already exist so the
  // migration is safe to re-run after partial failure.
  for (const seed of CROCHET_SEEDS) {
    const existing = await knex('chart_symbol_templates')
      .where({ symbol: seed.symbol })
      .whereNull('user_id')
      .first();

    if (existing) {
      await knex('chart_symbol_templates')
        .where({ id: existing.id })
        .update({
          name: seed.name,
          category: seed.category,
          description: seed.description,
          abbreviation: seed.abbreviation,
          rs_instruction: seed.rs_instruction,
          ws_instruction: seed.ws_instruction,
          cell_span: seed.cell_span,
          craft: 'crochet',
          is_system: true,
        });
    } else {
      await knex('chart_symbol_templates').insert({
        symbol: seed.symbol,
        name: seed.name,
        category: seed.category,
        description: seed.description,
        abbreviation: seed.abbreviation,
        rs_instruction: seed.rs_instruction,
        ws_instruction: seed.ws_instruction,
        cell_span: seed.cell_span,
        craft: 'crochet',
        is_system: true,
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex('chart_symbol_templates')
    .whereIn('symbol', CROCHET_SEEDS.map((s) => s.symbol))
    .where({ is_system: true })
    .whereNull('user_id')
    .delete();

  await knex.raw(
    `ALTER TABLE chart_symbol_templates DROP CONSTRAINT IF EXISTS chart_symbol_templates_craft_check`
  );

  await knex.schema.alterTable('chart_symbol_templates', (table) => {
    table.dropIndex('craft', 'idx_symbol_templates_craft');
    table.dropColumn('abbreviation');
    table.dropColumn('rs_instruction');
    table.dropColumn('ws_instruction');
    table.dropColumn('cell_span');
    table.dropColumn('craft');
  });
}
