"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    // Audio notes
    await knex.schema.createTable('audio_notes', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
        table.uuid('pattern_id').nullable().references('id').inTable('patterns').onDelete('SET NULL');
        table.string('audio_url', 500).notNullable();
        table.text('transcription').nullable();
        table.integer('duration_seconds').nullable();
        table.jsonb('counter_values').nullable(); // Snapshot of counters when note was created
        table.timestamp('created_at').defaultTo(knex.fn.now());
        // Indexes
        table.index('project_id');
        table.index('pattern_id');
        table.index('created_at');
    });
    // Structured memos
    await knex.schema.createTable('structured_memos', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
        table.string('template_type', 50).notNullable(); // 'gauge_swatch', 'fit_adjustment', 'yarn_substitution', 'finishing'
        table.jsonb('data').notNullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        // Indexes
        table.index('project_id');
        table.index('template_type');
    });
    // Magic markers (smart alerts)
    await knex.schema.createTable('magic_markers', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
        table.uuid('counter_id').nullable().references('id').inTable('counters').onDelete('SET NULL');
        table.string('trigger_type', 50).notNullable(); // 'counter_value', 'time_elapsed', 'date'
        table.jsonb('trigger_condition').notNullable(); // { "counter": "row", "operator": ">=", "value": 23 }
        table.text('alert_message').notNullable();
        table.string('alert_type', 50).defaultTo('info'); // 'info', 'warning', 'reminder'
        table.boolean('is_active').defaultTo(true);
        table.timestamp('last_triggered').nullable();
        table.timestamp('created_at').defaultTo(knex.fn.now());
        // Indexes
        table.index('project_id');
        table.index('counter_id');
        table.index(['project_id', 'is_active']);
    });
}
async function down(knex) {
    await knex.schema.dropTable('magic_markers');
    await knex.schema.dropTable('structured_memos');
    await knex.schema.dropTable('audio_notes');
}
