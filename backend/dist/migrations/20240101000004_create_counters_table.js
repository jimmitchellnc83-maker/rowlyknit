"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.createTable('counters', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
        table.string('name', 255).notNullable();
        table.string('type', 50).defaultTo('row'); // row, stitch, repeat, custom
        table.integer('current_value').defaultTo(0);
        table.integer('target_value');
        table.integer('increment_by').defaultTo(1);
        table.integer('min_value').defaultTo(0);
        table.integer('max_value');
        table.text('notes');
        table.boolean('is_active').defaultTo(true);
        table.integer('sort_order').defaultTo(0);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        // Indexes
        table.index('project_id');
        table.index(['project_id', 'sort_order']);
        table.index(['project_id', 'is_active']);
    });
    // Create counter history table for undo functionality
    await knex.schema.createTable('counter_history', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('counter_id').notNullable().references('id').inTable('counters').onDelete('CASCADE');
        table.integer('old_value').notNullable();
        table.integer('new_value').notNullable();
        table.string('action', 50); // increment, decrement, reset, set
        table.timestamp('created_at').defaultTo(knex.fn.now());
        // Indexes
        table.index('counter_id');
        table.index(['counter_id', 'created_at']);
    });
}
async function down(knex) {
    await knex.schema.dropTable('counter_history');
    return knex.schema.dropTable('counters');
}
