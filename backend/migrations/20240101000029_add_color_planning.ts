import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Track colors per project
  await knex.schema.createTable('project_colors', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE');
    table.string('color_name', 100).notNullable();
    table.string('hex_code', 7).notNullable();
    table.uuid('yarn_id').references('id').inTable('yarn_stash').onDelete('SET NULL').nullable();
    table.decimal('estimated_yardage', 10, 2).nullable();
    table.decimal('actual_yardage', 10, 2).nullable();
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('project_id', 'idx_project_colors_project');
  });

  // Track gradient/color transitions
  await knex.schema.createTable('color_transitions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE');
    table.string('name', 100).defaultTo('Color Plan');
    table.string('transition_type', 50).defaultTo('gradient'); // gradient, stripe, fair_isle, intarsia
    table.jsonb('color_sequence').defaultTo('[]'); // Array of {color_id, start_row, end_row, percentage}
    table.jsonb('transition_settings').defaultTo('{}'); // {rows_per_color, fade_rows, repeat_count, etc}
    table.integer('total_rows').nullable();
    table.boolean('is_active').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('project_id', 'idx_color_transitions_project');
  });

  // Store extracted color palettes from images
  await knex.schema.createTable('color_palettes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('project_id').references('id').inTable('projects').onDelete('SET NULL').nullable();
    table.string('name', 100).defaultTo('Extracted Palette');
    table.string('source_image_url', 500).nullable();
    table.jsonb('colors').defaultTo('[]'); // Array of {hex, percentage, name}
    table.string('palette_type', 50).defaultTo('extracted'); // extracted, generated, custom
    table.string('base_scheme', 50).nullable(); // analogous, complementary, triadic, monochromatic
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('user_id', 'idx_color_palettes_user');
    table.index('project_id', 'idx_color_palettes_project');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('color_palettes');
  await knex.schema.dropTableIfExists('color_transitions');
  await knex.schema.dropTableIfExists('project_colors');
}
