import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add marker analytics columns to magic_markers table
  await knex.schema.alterTable('magic_markers', (table) => {
    table.integer('times_triggered').defaultTo(0);
    table.integer('times_snoozed').defaultTo(0);
    table.integer('times_acknowledged').defaultTo(0);
    table.boolean('suggested_by_ai').defaultTo(false);
    table.string('marker_color', 20).defaultTo('blue');
    table.string('status', 20).defaultTo('active'); // active, completed, snoozed
  });

  // Create pattern_analysis table for storing analysis results
  await knex.schema.createTable('pattern_analysis', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').references('id').inTable('projects').onDelete('CASCADE');
    table.text('analysis_text').nullable();
    table.jsonb('suggested_markers').defaultTo('[]'); // Array of marker suggestions
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('project_id', 'idx_pattern_analysis_project');
  });

  // Create marker_events table for tracking marker interactions
  await knex.schema.createTable('marker_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('marker_id').references('id').inTable('magic_markers').onDelete('CASCADE');
    table.string('event_type', 30).notNullable(); // triggered, snoozed, acknowledged, completed
    table.integer('at_row').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('marker_id', 'idx_marker_events_marker');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('marker_events');
  await knex.schema.dropTableIfExists('pattern_analysis');

  await knex.schema.alterTable('magic_markers', (table) => {
    table.dropColumn('times_triggered');
    table.dropColumn('times_snoozed');
    table.dropColumn('times_acknowledged');
    table.dropColumn('suggested_by_ai');
    table.dropColumn('marker_color');
    table.dropColumn('status');
  });
}
