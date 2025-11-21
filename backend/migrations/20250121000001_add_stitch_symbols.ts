import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add additional stitch symbols to match the frontend Pattern Builder library
  // These are based on Craft Yarn Council standards

  const existingSymbols = await knex('chart_symbols').select('symbol');
  const existingSymbolSet = new Set(existingSymbols.map(s => s.symbol));

  const additionalSymbols = [
    // Basic symbols (add Empty if not exists)
    {
      symbol: '|',
      name: 'Knit',
      description: 'Knit on RS, purl on WS (vertical line notation)',
      color: '#FFFFFF',
      category: 'basic',
      is_custom: false,
    },
    {
      symbol: '−',
      name: 'Purl',
      description: 'Purl on RS, knit on WS (dash notation)',
      color: '#E0E0E0',
      category: 'basic',
      is_custom: false,
    },
    {
      symbol: '○',
      name: 'Yarn Over',
      description: 'Yarn over (creates eyelet)',
      color: '#FFD700',
      category: 'lace',
      is_custom: false,
    },
    {
      symbol: '×',
      name: 'No Stitch',
      description: 'Placeholder - no stitch exists (used for shaping)',
      color: '#F5F5F5',
      category: 'special',
      is_custom: false,
    },
    // Decreases
    {
      symbol: '⟩',
      name: 'K2tog',
      description: 'Knit 2 together - right-leaning decrease',
      color: '#FF9999',
      category: 'decrease',
      is_custom: false,
    },
    {
      symbol: '⟨',
      name: 'SSK',
      description: 'Slip slip knit - left-leaning decrease',
      color: '#FF9999',
      category: 'decrease',
      is_custom: false,
    },
    {
      symbol: '⋀',
      name: 'K3tog',
      description: 'Knit 3 together - double decrease',
      color: '#FF9999',
      category: 'decrease',
      is_custom: false,
    },
    {
      symbol: '⋏',
      name: 'SK2P',
      description: 'Slip 1, knit 2 together, pass slipped stitch over - centered double decrease',
      color: '#FF9999',
      category: 'decrease',
      is_custom: false,
    },
    // Increases
    {
      symbol: '⋎',
      name: 'KFB',
      description: 'Knit front and back - increase',
      color: '#99FF99',
      category: 'increase',
      is_custom: false,
    },
    {
      symbol: '⊲',
      name: 'M1L',
      description: 'Make 1 left - left-leaning increase',
      color: '#99FF99',
      category: 'increase',
      is_custom: false,
    },
    {
      symbol: '⊳',
      name: 'M1R',
      description: 'Make 1 right - right-leaning increase',
      color: '#99FF99',
      category: 'increase',
      is_custom: false,
    },
    {
      symbol: '⊕',
      name: 'M1',
      description: 'Make 1 knitwise',
      color: '#99FF99',
      category: 'increase',
      is_custom: false,
    },
    // Special stitches
    {
      symbol: '⊙',
      name: 'K tbl',
      description: 'Knit through back loop on RS, purl through back loop on WS',
      color: '#CC99FF',
      category: 'texture',
      is_custom: false,
    },
    {
      symbol: '⊘',
      name: 'P tbl',
      description: 'Purl through back loop on RS, knit through back loop on WS',
      color: '#CC99FF',
      category: 'texture',
      is_custom: false,
    },
    {
      symbol: 'V',
      name: 'Slip',
      description: 'Slip stitch purlwise with yarn in back',
      color: '#FFFFFF',
      category: 'special',
      is_custom: false,
    },
    {
      symbol: '◐',
      name: 'Wrap and Turn',
      description: 'Wrap and turn for short row shaping',
      color: '#FFCC99',
      category: 'special',
      is_custom: false,
    },
    // Cables
    {
      symbol: '⤨',
      name: '1/1 RC',
      description: 'Right cross 1 over 1 - slip 1 to cable needle, hold in back, k1, k1 from CN',
      color: '#9999FF',
      category: 'cable',
      is_custom: false,
    },
    {
      symbol: '⤧',
      name: '1/1 LC',
      description: 'Left cross 1 over 1 - slip 1 to cable needle, hold in front, k1, k1 from CN',
      color: '#9999FF',
      category: 'cable',
      is_custom: false,
    },
    {
      symbol: '⤪',
      name: '2/2 RC',
      description: 'Right cross 2 over 2 - slip 2 to cable needle, hold in back, k2, k2 from CN',
      color: '#9999FF',
      category: 'cable',
      is_custom: false,
    },
    {
      symbol: '⤩',
      name: '2/2 LC',
      description: 'Left cross 2 over 2 - slip 2 to cable needle, hold in front, k2, k2 from CN',
      color: '#9999FF',
      category: 'cable',
      is_custom: false,
    },
  ];

  // Only insert symbols that don't already exist
  const symbolsToInsert = additionalSymbols.filter(s => !existingSymbolSet.has(s.symbol));

  if (symbolsToInsert.length > 0) {
    await knex('chart_symbols').insert(symbolsToInsert);
  }
}

export async function down(knex: Knex): Promise<void> {
  // Remove the additional symbols we added
  const symbolsToRemove = ['|', '−', '○', '×', '⟩', '⟨', '⋀', '⋏', '⋎', '⊲', '⊳', '⊕', '⊙', '⊘', 'V', '◐', '⤨', '⤧', '⤪', '⤩'];

  await knex('chart_symbols')
    .whereIn('symbol', symbolsToRemove)
    .andWhere('is_custom', false)
    .del();
}
