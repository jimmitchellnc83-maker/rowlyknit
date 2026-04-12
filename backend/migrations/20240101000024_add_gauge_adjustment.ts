import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add gauge tracking columns to projects table
  await knex.schema.alterTable('projects', (table) => {
    // Pattern gauge values
    table.decimal('pattern_gauge_stitches', 5, 2).nullable();
    table.decimal('pattern_gauge_rows', 5, 2).nullable();
    table.integer('pattern_gauge_measurement').defaultTo(4); // inches

    // User's actual gauge values
    table.decimal('actual_gauge_stitches', 5, 2).nullable();
    table.decimal('actual_gauge_rows', 5, 2).nullable();
    table.integer('actual_gauge_measurement').defaultTo(4); // inches

    // Adjustment tracking
    table.boolean('gauge_adjusted').defaultTo(false);
    table.text('adjusted_instructions').nullable();
    table.text('original_instructions').nullable();
  });

  // Create gauge_adjustments table for history
  await knex.schema.createTable('gauge_adjustments', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.text('original_instructions').notNullable();
    table.text('adjusted_instructions').notNullable();
    table.decimal('pattern_gauge_stitches', 5, 2).notNullable();
    table.decimal('pattern_gauge_rows', 5, 2).notNullable();
    table.decimal('actual_gauge_stitches', 5, 2).notNullable();
    table.decimal('actual_gauge_rows', 5, 2).notNullable();
    table.decimal('stitch_multiplier', 5, 4).nullable();
    table.decimal('row_multiplier', 5, 4).nullable();
    table.integer('stitch_difference_percent').nullable();
    table.integer('row_difference_percent').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('project_id');
  });

  // Add index for gauge-adjusted projects
  await knex.schema.alterTable('projects', (table) => {
    table.index('gauge_adjusted');
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop gauge_adjustments table
  await knex.schema.dropTable('gauge_adjustments');

  // Remove index from projects
  await knex.schema.alterTable('projects', (table) => {
    table.dropIndex('gauge_adjusted');
  });

  // Remove columns from projects table
  await knex.schema.alterTable('projects', (table) => {
    table.dropColumn('original_instructions');
    table.dropColumn('adjusted_instructions');
    table.dropColumn('gauge_adjusted');
    table.dropColumn('actual_gauge_measurement');
    table.dropColumn('actual_gauge_rows');
    table.dropColumn('actual_gauge_stitches');
    table.dropColumn('pattern_gauge_measurement');
    table.dropColumn('pattern_gauge_rows');
    table.dropColumn('pattern_gauge_stitches');
  });
}
