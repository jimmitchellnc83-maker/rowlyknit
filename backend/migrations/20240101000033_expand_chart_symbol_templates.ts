import { Knex } from 'knex';

interface SymbolSeed {
  symbol: string;
  name: string;
  category: string;
  description: string;
}

const SYMBOL_SEEDS: SymbolSeed[] = [
  { symbol: 'k', name: 'Knit', category: 'basic', description: 'Knit stitch' },
  { symbol: 'p', name: 'Purl', category: 'basic', description: 'Purl stitch' },
  { symbol: 'yo', name: 'Yarn Over', category: 'increase', description: 'Creates an eyelet and adds a stitch' },
  { symbol: 'k2tog', name: 'K2tog', category: 'decrease', description: 'Right-leaning decrease' },
  { symbol: 'ssk', name: 'SSK', category: 'decrease', description: 'Left-leaning decrease' },
  { symbol: 'sl', name: 'Slip', category: 'basic', description: 'Slip stitch purlwise' },
  { symbol: 'kfb', name: 'KFB', category: 'increase', description: 'Knit front and back to increase one stitch' },
  { symbol: 'pfb', name: 'PFB', category: 'increase', description: 'Purl front and back to increase one stitch' },
  { symbol: 'm1l', name: 'M1L', category: 'increase', description: 'Left-leaning bar increase' },
  { symbol: 'm1r', name: 'M1R', category: 'increase', description: 'Right-leaning bar increase' },
  { symbol: 'c4f', name: 'Cable 4 Front', category: 'cable', description: '4-stitch cable crossing to the front' },
  { symbol: 'c4b', name: 'Cable 4 Back', category: 'cable', description: '4-stitch cable crossing to the back' },
  { symbol: 'c6f', name: 'Cable 6 Front', category: 'cable', description: '6-stitch cable crossing to the front' },
  { symbol: 'c6b', name: 'Cable 6 Back', category: 'cable', description: '6-stitch cable crossing to the back' },
  { symbol: 'x', name: 'No Stitch', category: 'placeholder', description: 'No stitch / skip cell' },
  { symbol: '[]', name: 'Empty', category: 'placeholder', description: 'Empty chart cell' },
  { symbol: '.', name: 'Knit (alt)', category: 'basic', description: 'Alternate knit symbol' },
  { symbol: '-', name: 'Purl (alt)', category: 'basic', description: 'Alternate purl symbol' },
  { symbol: 'yo2', name: 'Double Yarn Over', category: 'increase', description: 'Adds two stitches with a double yarn over' },
  { symbol: 't2r', name: 'Twist Right', category: 'twist', description: 'Right twist over two stitches' },
  { symbol: 't2l', name: 'Twist Left', category: 'twist', description: 'Left twist over two stitches' },
  { symbol: 'rt', name: 'Right Twist', category: 'twist', description: 'Right-leaning single twist' },
  { symbol: 'lt', name: 'Left Twist', category: 'twist', description: 'Left-leaning single twist' },
  { symbol: 'bobble', name: 'Bobble', category: 'special', description: 'Raised bobble stitch' },
  { symbol: 'popcorn', name: 'Popcorn', category: 'special', description: 'Popcorn textured stitch' },
  { symbol: 'seed', name: 'Seed Stitch', category: 'colorwork', description: 'Seed stitch texture' },
  { symbol: 'mc', name: 'Main Color', category: 'colorwork', description: 'Main color marker for charts' },
  { symbol: 'cc', name: 'Contrast Color', category: 'colorwork', description: 'Contrast color marker for charts' },
  { symbol: 'inc-r', name: 'Lifted Inc Right', category: 'increase', description: 'Right-leaning lifted increase' },
  { symbol: 'inc-l', name: 'Lifted Inc Left', category: 'increase', description: 'Left-leaning lifted increase' },
  { symbol: 'p2tog', name: 'P2tog', category: 'decrease', description: 'Purl two together decrease' },
  { symbol: 'ssp', name: 'SSP', category: 'decrease', description: 'Slip, slip, purl decrease' },
];

export async function up(knex: Knex): Promise<void> {
  await knex('chart_symbol_templates')
    .insert(SYMBOL_SEEDS.map((symbol) => ({
      ...symbol,
      is_system: true,
    })))
    .onConflict('symbol')
    .merge(['name', 'category', 'description', 'is_system']);
}

export async function down(knex: Knex): Promise<void> {
  await knex('chart_symbol_templates')
    .whereIn('symbol', SYMBOL_SEEDS.map((s) => s.symbol))
    .delete();
}
