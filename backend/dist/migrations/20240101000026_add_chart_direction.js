"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    // Add direction tracking to chart_progress
    await knex.schema.alterTable('chart_progress', (table) => {
        // Working direction: how the chart is being worked
        table.string('working_direction', 20).defaultTo('flat_knitting');
        // Current direction for the current row
        table.string('current_direction', 15).defaultTo('left_to_right');
        // Total row count in the chart
        table.integer('row_count').defaultTo(1);
    });
    // Create direction history table for undo functionality
    await knex.schema.createTable('chart_direction_history', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('chart_progress_id').notNullable().references('id').inTable('chart_progress').onDelete('CASCADE');
        table.integer('row_number').notNullable();
        table.string('direction', 15).notNullable();
        table.integer('column_position').defaultTo(0);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        // Index for efficient lookups
        table.index('chart_progress_id');
        table.index(['chart_progress_id', 'row_number']);
    });
}
async function down(knex) {
    // Drop direction history table
    await knex.schema.dropTable('chart_direction_history');
    // Remove columns from chart_progress
    await knex.schema.alterTable('chart_progress', (table) => {
        table.dropColumn('row_count');
        table.dropColumn('current_direction');
        table.dropColumn('working_direction');
    });
}
