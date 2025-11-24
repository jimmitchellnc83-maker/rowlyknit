import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Check if symbols already exist
  const existing = await knex('chart_symbol_templates').where('is_system', true).first();
  if (existing) {
    console.log('System symbols already seeded');
    return;
  }

  // Insert standard knitting chart symbols
  await knex('chart_symbol_templates').insert([
    // Basic stitches
    { symbol: 'k', name: 'Knit', category: 'basic', description: 'Knit stitch on RS, purl on WS', is_system: true },
    { symbol: 'p', name: 'Purl', category: 'basic', description: 'Purl stitch on RS, knit on WS', is_system: true },
    { symbol: '.', name: 'Knit (alt)', category: 'basic', description: 'Alternative knit symbol', is_system: true },
    { symbol: '-', name: 'Purl (alt)', category: 'basic', description: 'Alternative purl symbol', is_system: true },

    // Yarn overs and increases
    { symbol: 'yo', name: 'Yarn Over', category: 'increase', description: 'Wrap yarn around needle', is_system: true },
    { symbol: 'o', name: 'Yarn Over (alt)', category: 'increase', description: 'Alternative yarn over symbol', is_system: true },
    { symbol: 'm1l', name: 'Make 1 Left', category: 'increase', description: 'Left-leaning increase', is_system: true },
    { symbol: 'm1r', name: 'Make 1 Right', category: 'increase', description: 'Right-leaning increase', is_system: true },
    { symbol: 'kfb', name: 'Knit Front & Back', category: 'increase', description: 'Increase by knitting into front and back', is_system: true },
    { symbol: 'inc', name: 'Increase', category: 'increase', description: 'General increase', is_system: true },

    // Decreases
    { symbol: 'k2tog', name: 'Knit 2 Together', category: 'decrease', description: 'Right-leaning decrease', is_system: true },
    { symbol: '/', name: 'K2tog (alt)', category: 'decrease', description: 'Alternative k2tog symbol', is_system: true },
    { symbol: 'ssk', name: 'Slip Slip Knit', category: 'decrease', description: 'Left-leaning decrease', is_system: true },
    { symbol: '\\', name: 'SSK (alt)', category: 'decrease', description: 'Alternative SSK symbol', is_system: true },
    { symbol: 'p2tog', name: 'Purl 2 Together', category: 'decrease', description: 'Purl decrease', is_system: true },
    { symbol: 'cdd', name: 'Central Double Decrease', category: 'decrease', description: 'Slip 2 sts together, k1, pass slipped sts over', is_system: true },
    { symbol: 's2kp', name: 'S2KP', category: 'decrease', description: 'Slip 2 together knitwise, k1, pass slipped sts over', is_system: true },
    { symbol: 'sk2p', name: 'SK2P', category: 'decrease', description: 'Slip 1, k2tog, pass slipped st over', is_system: true },

    // Slip stitches
    { symbol: 'sl', name: 'Slip', category: 'slip', description: 'Slip stitch purlwise', is_system: true },
    { symbol: 'slk', name: 'Slip Knitwise', category: 'slip', description: 'Slip stitch knitwise', is_system: true },
    { symbol: 'slwyif', name: 'Slip With Yarn In Front', category: 'slip', description: 'Slip purlwise with yarn in front', is_system: true },
    { symbol: 'slwyib', name: 'Slip With Yarn In Back', category: 'slip', description: 'Slip purlwise with yarn in back', is_system: true },

    // Cables
    { symbol: 'c4f', name: 'Cable 4 Front', category: 'cable', description: '4-stitch left-leaning cable', is_system: true },
    { symbol: 'c4b', name: 'Cable 4 Back', category: 'cable', description: '4-stitch right-leaning cable', is_system: true },
    { symbol: 'c6f', name: 'Cable 6 Front', category: 'cable', description: '6-stitch left-leaning cable', is_system: true },
    { symbol: 'c6b', name: 'Cable 6 Back', category: 'cable', description: '6-stitch right-leaning cable', is_system: true },
    { symbol: 't2f', name: 'Twist 2 Front', category: 'cable', description: '2-stitch left twist', is_system: true },
    { symbol: 't2b', name: 'Twist 2 Back', category: 'cable', description: '2-stitch right twist', is_system: true },

    // Special symbols
    { symbol: 'x', name: 'No Stitch', category: 'special', description: 'Placeholder for no stitch', is_system: true },
    { symbol: '[]', name: 'No Stitch (alt)', category: 'special', description: 'Alternative no stitch symbol', is_system: true },
    { symbol: 'bo', name: 'Bind Off', category: 'special', description: 'Bind off stitch', is_system: true },
    { symbol: 'co', name: 'Cast On', category: 'special', description: 'Cast on stitch', is_system: true },
    { symbol: 'tbl', name: 'Through Back Loop', category: 'special', description: 'Work stitch through back loop', is_system: true },
    { symbol: 'ktbl', name: 'Knit TBL', category: 'special', description: 'Knit through back loop', is_system: true },
    { symbol: 'ptbl', name: 'Purl TBL', category: 'special', description: 'Purl through back loop', is_system: true },

    // Colorwork
    { symbol: 'mc', name: 'Main Color', category: 'colorwork', description: 'Main color stitch', is_system: true },
    { symbol: 'cc', name: 'Contrast Color', category: 'colorwork', description: 'Contrast color stitch', is_system: true },
    { symbol: 'cc1', name: 'Contrast Color 1', category: 'colorwork', description: 'First contrast color', is_system: true },
    { symbol: 'cc2', name: 'Contrast Color 2', category: 'colorwork', description: 'Second contrast color', is_system: true },
  ]);

  console.log('Seeded chart symbol templates');
}
