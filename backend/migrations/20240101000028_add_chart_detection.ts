import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create charts table if it doesn't exist
  if (!(await knex.schema.hasTable('charts'))) {
    await knex.schema.createTable('charts', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.uuid('project_id').references('id').inTable('projects').onDelete('SET NULL').nullable();
      table.string('name', 255).defaultTo('Untitled Chart');
      table.jsonb('grid').defaultTo('[]'); // 2D array of symbols
      table.integer('rows').defaultTo(0);
      table.integer('columns').defaultTo(0);
      table.jsonb('symbol_legend').defaultTo('{}');
      table.text('description').nullable();
      table.string('source', 50).defaultTo('manual'); // manual, image_import, shared_copy
      table.string('source_image_url', 500).nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());

      table.index('user_id', 'idx_charts_user');
      table.index('project_id', 'idx_charts_project');
    });
  }

  // Create detected_charts table to store image detection results
  await knex.schema.createTable('detected_charts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('name', 255).defaultTo('Imported Chart');
    table.string('original_image_url', 500).nullable();
    table.string('processed_image_url', 500).nullable();
    table.jsonb('grid').defaultTo('[]'); // 2D array of symbols
    table.integer('grid_rows').defaultTo(0);
    table.integer('grid_cols').defaultTo(0);
    table.decimal('confidence', 5, 4).defaultTo(0);
    table.jsonb('unrecognized_cells').defaultTo('[]'); // Array of {row, col}
    table.jsonb('corrections').defaultTo('[]'); // User corrections: {row, col, original, corrected}
    table.string('status', 20).defaultTo('pending'); // pending, processing, completed, failed
    table.text('error_message').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('project_id', 'idx_detected_charts_project');
    table.index('user_id', 'idx_detected_charts_user');
    table.index('status', 'idx_detected_charts_status');
  });

  // Create chart_symbol_templates for symbol recognition
  await knex.schema.createTable('chart_symbol_templates', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('symbol', 10).notNullable();
    table.string('name', 100).notNullable();
    table.string('category', 50).nullable(); // knit, purl, cable, decrease, increase, etc.
    table.text('description').nullable();
    table.jsonb('variations').defaultTo('[]'); // Different visual representations
    table.boolean('is_system').defaultTo(false); // System vs user-defined
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.unique(['symbol', 'user_id']);
    table.index('category', 'idx_symbol_templates_category');
  });

  // Seed standard knitting symbols
  await knex('chart_symbol_templates').insert([
    { symbol: 'k', name: 'Knit', category: 'basic', description: 'Knit stitch', is_system: true },
    { symbol: 'p', name: 'Purl', category: 'basic', description: 'Purl stitch', is_system: true },
    { symbol: '.', name: 'Knit (alt)', category: 'basic', description: 'Knit stitch (alternate)', is_system: true },
    { symbol: '-', name: 'Purl (alt)', category: 'basic', description: 'Purl stitch (alternate)', is_system: true },
    { symbol: 'yo', name: 'Yarn Over', category: 'increase', description: 'Yarn over', is_system: true },
    { symbol: 'o', name: 'Yarn Over (alt)', category: 'increase', description: 'Yarn over (alternate)', is_system: true },
    { symbol: 'k2tog', name: 'Knit 2 Together', category: 'decrease', description: 'Right-leaning decrease', is_system: true },
    { symbol: '/', name: 'K2tog (alt)', category: 'decrease', description: 'K2tog (alternate)', is_system: true },
    { symbol: 'ssk', name: 'Slip Slip Knit', category: 'decrease', description: 'Left-leaning decrease', is_system: true },
    { symbol: '\\', name: 'SSK (alt)', category: 'decrease', description: 'SSK (alternate)', is_system: true },
    { symbol: 'sl', name: 'Slip', category: 'slip', description: 'Slip stitch purlwise', is_system: true },
    { symbol: 'v', name: 'Slip (alt)', category: 'slip', description: 'Slip stitch (alternate)', is_system: true },
    { symbol: 'm1l', name: 'Make 1 Left', category: 'increase', description: 'Left-leaning increase', is_system: true },
    { symbol: 'm1r', name: 'Make 1 Right', category: 'increase', description: 'Right-leaning increase', is_system: true },
    { symbol: 'kfb', name: 'Knit Front Back', category: 'increase', description: 'Knit into front and back', is_system: true },
    { symbol: 'c4f', name: 'Cable 4 Front', category: 'cable', description: '4-stitch cable, front cross', is_system: true },
    { symbol: 'c4b', name: 'Cable 4 Back', category: 'cable', description: '4-stitch cable, back cross', is_system: true },
    { symbol: 'x', name: 'No Stitch', category: 'placeholder', description: 'No stitch / placeholder', is_system: true },
    { symbol: '[]', name: 'Empty', category: 'placeholder', description: 'Empty cell', is_system: true },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('chart_symbol_templates');
  await knex.schema.dropTableIfExists('detected_charts');
  await knex.schema.dropTableIfExists('charts');
}
