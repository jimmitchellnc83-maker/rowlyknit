"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    // Add hierarchy and auto-reset columns to counters table
    await knex.schema.alterTable('counters', (table) => {
        // Parent counter for nesting/hierarchy
        table.uuid('parent_counter_id')
            .nullable()
            .references('id')
            .inTable('counters')
            .onDelete('SET NULL');
        // Auto-reset when target is reached
        table.boolean('auto_reset').defaultTo(false);
        // Index for efficient parent lookups
        table.index('parent_counter_id');
    });
}
async function down(knex) {
    await knex.schema.alterTable('counters', (table) => {
        table.dropIndex('parent_counter_id');
        table.dropColumn('auto_reset');
        table.dropColumn('parent_counter_id');
    });
}
