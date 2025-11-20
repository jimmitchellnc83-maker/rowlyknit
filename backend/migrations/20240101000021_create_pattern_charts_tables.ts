import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Chart symbols library (shared across all charts)
  await knex.schema.createTable('chart_symbols', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('symbol', 10).notNullable(); // The actual symbol character(s)
    table.string('name', 100).notNullable(); // e.g., "Knit", "Purl"
    table.text('description').notNullable(); // Detailed description of the stitch
    table.string('color', 7).nullable(); // Hex color code
    table.string('category', 50).defaultTo('basic'); // basic, increase, decrease, cable, lace, etc.
    table.boolean('is_custom').defaultTo(false); // User-created vs standard symbols
    table.uuid('user_id').nullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index(['symbol', 'category']);
    table.index('user_id');
  });

  // Pattern charts
  await knex.schema.createTable('pattern_charts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('pattern_id').notNullable().references('id').inTable('patterns').onDelete('CASCADE');
    table.string('title', 255).notNullable();
    table.integer('rows').notNullable(); // Number of rows in chart
    table.integer('cols').notNullable(); // Number of columns in chart
    table.boolean('is_in_the_round').defaultTo(false);
    table.text('notes').nullable();
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('pattern_id');
    table.index(['pattern_id', 'sort_order']);
  });

  // Chart cells (the actual chart data)
  await knex.schema.createTable('chart_cells', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('chart_id').notNullable().references('id').inTable('pattern_charts').onDelete('CASCADE');
    table.integer('row').notNullable();
    table.integer('col').notNullable();
    table.uuid('symbol_id').notNullable().references('id').inTable('chart_symbols').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Composite unique constraint
    table.unique(['chart_id', 'row', 'col']);

    // Indexes
    table.index('chart_id');
    table.index('symbol_id');
    table.index(['chart_id', 'row']);
  });

  // Chart-symbol associations (which symbols are used in which chart)
  await knex.schema.createTable('chart_symbol_associations', (table) => {
    table.uuid('chart_id').notNullable().references('id').inTable('pattern_charts').onDelete('CASCADE');
    table.uuid('symbol_id').notNullable().references('id').inTable('chart_symbols').onDelete('CASCADE');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Composite primary key
    table.primary(['chart_id', 'symbol_id']);

    // Indexes
    table.index('chart_id');
    table.index('symbol_id');
  });

  // Seed standard chart symbols
  await knex('chart_symbols').insert([
    {
      symbol: '·',
      name: 'Knit',
      description: 'Knit on RS, purl on WS',
      color: '#FFFFFF',
      category: 'basic',
      is_custom: false,
    },
    {
      symbol: '—',
      name: 'Purl',
      description: 'Purl on RS, knit on WS',
      color: '#E0E0E0',
      category: 'basic',
      is_custom: false,
    },
    {
      symbol: 'O',
      name: 'Yarn Over',
      description: 'Yarn over',
      color: '#FFD700',
      category: 'lace',
      is_custom: false,
    },
    {
      symbol: '/',
      name: 'K2tog',
      description: 'Knit 2 together (right-leaning decrease)',
      color: '#FF9999',
      category: 'decrease',
      is_custom: false,
    },
    {
      symbol: '\\',
      name: 'SSK',
      description: 'Slip, slip, knit (left-leaning decrease)',
      color: '#FF9999',
      category: 'decrease',
      is_custom: false,
    },
    {
      symbol: 'M',
      name: 'Make 1 Left',
      description: 'Make 1 left-leaning increase',
      color: '#99FF99',
      category: 'increase',
      is_custom: false,
    },
    {
      symbol: 'M̄',
      name: 'Make 1 Right',
      description: 'Make 1 right-leaning increase',
      color: '#99FF99',
      category: 'increase',
      is_custom: false,
    },
    {
      symbol: '⊗',
      name: 'Bobble',
      description: 'Make bobble (k1, p1, k1, p1, k1) in same st, turn and purl 5, turn and k5, turn and p2tog, p1, p2tog, turn and k3tog',
      color: '#CC99FF',
      category: 'texture',
      is_custom: false,
    },
    {
      symbol: 'C4F',
      name: 'Cable 4 Front',
      description: 'Slip 2 sts to cable needle and hold in front, k2, k2 from cable needle',
      color: '#9999FF',
      category: 'cable',
      is_custom: false,
    },
    {
      symbol: 'C4B',
      name: 'Cable 4 Back',
      description: 'Slip 2 sts to cable needle and hold in back, k2, k2 from cable needle',
      color: '#9999FF',
      category: 'cable',
      is_custom: false,
    },
    {
      symbol: '□',
      name: 'No Stitch',
      description: 'No stitch (placeholder for shaping)',
      color: '#F5F5F5',
      category: 'special',
      is_custom: false,
    },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('chart_symbol_associations');
  await knex.schema.dropTableIfExists('chart_cells');
  await knex.schema.dropTableIfExists('pattern_charts');
  await knex.schema.dropTableIfExists('chart_symbols');
}
