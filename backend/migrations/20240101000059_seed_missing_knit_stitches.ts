import { Knex } from 'knex';

/**
 * Migration 059: idempotent reseed of knit system stitches that migration 033
 * was supposed to add but didn't actually land on prod.
 *
 * 058 backfilled abbreviation / RS / WS / cell_span only via UPDATE, so any
 * symbol that was already missing stayed missing. This migration upserts
 * the full row for each, so prod and fresh dev databases converge.
 *
 * The 17 knit symbols below are the ones migration 033 declared as system
 * seeds beyond migration 028's original 19, plus the four cable + lifted
 * symbols whose data benefits from being asserted in one place.
 */

interface KnitSeed {
  symbol: string;
  name: string;
  category: string;
  description: string;
  abbreviation: string | null;
  rs_instruction: string | null;
  ws_instruction: string | null;
  cell_span: number;
}

const KNIT_SEEDS: KnitSeed[] = [
  { symbol: 'pfb', name: 'PFB', category: 'increase', description: 'Purl front and back to increase one stitch', abbreviation: 'pfb', rs_instruction: null, ws_instruction: 'pfb', cell_span: 1 },
  { symbol: 'c6f', name: 'Cable 6 Front', category: 'cable', description: '6-stitch cable crossing to the front', abbreviation: 'C6F', rs_instruction: 'sl 3 to cn, hold front, k3, k3 from cn', ws_instruction: null, cell_span: 6 },
  { symbol: 'c6b', name: 'Cable 6 Back', category: 'cable', description: '6-stitch cable crossing to the back', abbreviation: 'C6B', rs_instruction: 'sl 3 to cn, hold back, k3, k3 from cn', ws_instruction: null, cell_span: 6 },
  { symbol: 'yo2', name: 'Double Yarn Over', category: 'increase', description: 'Adds two stitches with a double yarn over', abbreviation: 'yo2', rs_instruction: '(yo) twice', ws_instruction: '(yo) twice', cell_span: 1 },
  { symbol: 't2r', name: 'Twist Right', category: 'twist', description: 'Right twist over two stitches', abbreviation: 'T2R', rs_instruction: 'k second st in front of first, then k first st, slip both off', ws_instruction: null, cell_span: 2 },
  { symbol: 't2l', name: 'Twist Left', category: 'twist', description: 'Left twist over two stitches', abbreviation: 'T2L', rs_instruction: 'k second st through back loop, then k first st, slip both off', ws_instruction: null, cell_span: 2 },
  { symbol: 'rt', name: 'Right Twist', category: 'twist', description: 'Right-leaning single twist', abbreviation: 'RT', rs_instruction: 'k2tog leaving on left needle, k first st again, slip both off', ws_instruction: null, cell_span: 2 },
  { symbol: 'lt', name: 'Left Twist', category: 'twist', description: 'Left-leaning single twist', abbreviation: 'LT', rs_instruction: 'k second st tbl, then k first st, slip both off', ws_instruction: null, cell_span: 2 },
  { symbol: 'bobble', name: 'Bobble', category: 'special', description: 'Raised bobble stitch', abbreviation: 'MB', rs_instruction: 'make bobble (kfbf in next st, turn, p5, turn, k5, pass 4 sts over 1st)', ws_instruction: null, cell_span: 1 },
  { symbol: 'popcorn', name: 'Popcorn', category: 'special', description: 'Popcorn textured stitch', abbreviation: 'PC', rs_instruction: 'popcorn (5 sts in next st, turn, p5, turn, k5, pass 4 sts over 1st)', ws_instruction: null, cell_span: 1 },
  { symbol: 'seed', name: 'Seed Stitch', category: 'colorwork', description: 'Seed stitch texture marker', abbreviation: 'seed', rs_instruction: 'work in seed st', ws_instruction: 'work in seed st', cell_span: 1 },
  { symbol: 'mc', name: 'Main Color', category: 'colorwork', description: 'Main color marker for charts', abbreviation: 'MC', rs_instruction: 'k1 with MC', ws_instruction: 'p1 with MC', cell_span: 1 },
  { symbol: 'cc', name: 'Contrast Color', category: 'colorwork', description: 'Contrast color marker for charts', abbreviation: 'CC', rs_instruction: 'k1 with CC', ws_instruction: 'p1 with CC', cell_span: 1 },
  { symbol: 'inc-r', name: 'Lifted Inc Right', category: 'increase', description: 'Right-leaning lifted increase', abbreviation: 'RLI', rs_instruction: 'right lifted increase', ws_instruction: null, cell_span: 1 },
  { symbol: 'inc-l', name: 'Lifted Inc Left', category: 'increase', description: 'Left-leaning lifted increase', abbreviation: 'LLI', rs_instruction: 'left lifted increase', ws_instruction: null, cell_span: 1 },
  { symbol: 'p2tog', name: 'P2tog', category: 'decrease', description: 'Purl two together decrease', abbreviation: 'p2tog', rs_instruction: 'p2tog', ws_instruction: 'k2tog', cell_span: 1 },
  { symbol: 'ssp', name: 'SSP', category: 'decrease', description: 'Slip, slip, purl decrease', abbreviation: 'ssp', rs_instruction: 'ssp', ws_instruction: 'k2tog tbl', cell_span: 1 },
];

export async function up(knex: Knex): Promise<void> {
  for (const seed of KNIT_SEEDS) {
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
          craft: 'knit',
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
        craft: 'knit',
        is_system: true,
      });
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex('chart_symbol_templates')
    .whereIn(
      'symbol',
      KNIT_SEEDS.map((s) => s.symbol)
    )
    .where({ is_system: true })
    .whereNull('user_id')
    .delete();
}
