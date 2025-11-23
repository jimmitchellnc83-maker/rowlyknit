"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    // Pattern collations for merged PDFs
    await knex.schema.createTable('pattern_collations', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.jsonb('pattern_ids').notNullable(); // Array of pattern UUIDs
        table.string('file_path', 500).notNullable(); // Path to merged PDF
        table.integer('file_size').notNullable(); // File size in bytes
        table.integer('page_count').notNullable(); // Total pages in merged PDF
        table.timestamp('created_at').defaultTo(knex.fn.now());
        // Indexes
        table.index('user_id');
        table.index('created_at');
    });
}
async function down(knex) {
    await knex.schema.dropTable('pattern_collations');
}
