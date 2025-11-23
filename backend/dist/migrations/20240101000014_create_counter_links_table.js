"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    await knex.schema.createTable('counter_links', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('source_counter_id').notNullable().references('id').inTable('counters').onDelete('CASCADE');
        table.uuid('target_counter_id').notNullable().references('id').inTable('counters').onDelete('CASCADE');
        table.string('link_type', 50).notNullable(); // 'reset_on_target', 'advance_together', 'conditional'
        table.jsonb('trigger_condition').nullable(); // { "when": "equals", "value": 8 }
        table.jsonb('action').nullable(); // { "action": "reset", "to_value": 1 }
        table.boolean('is_active').defaultTo(true);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        // Indexes
        table.index('source_counter_id');
        table.index('target_counter_id');
        table.unique(['source_counter_id', 'target_counter_id']);
    });
}
async function down(knex) {
    await knex.schema.dropTable('counter_links');
}
