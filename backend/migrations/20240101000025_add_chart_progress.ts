import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create chart_progress table for tracking completion state
  await knex.schema.createTable('chart_progress', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('chart_id').notNullable(); // References chart in pattern
    table.integer('current_row').defaultTo(1);
    table.integer('current_column').defaultTo(1);
    table.jsonb('completed_cells').defaultTo('[]'); // Array of {row, col}
    table.jsonb('completed_rows').defaultTo('[]'); // Array of row numbers
    table.boolean('tracking_enabled').defaultTo(true);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Unique constraint - one progress record per project/chart combination
    table.unique(['project_id', 'chart_id']);

    // Indexes
    table.index('project_id');
    table.index('chart_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('chart_progress');
}
