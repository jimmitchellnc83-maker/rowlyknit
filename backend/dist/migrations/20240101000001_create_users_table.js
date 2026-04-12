"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    return knex.schema.createTable('users', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.string('email', 255).notNullable().unique();
        table.string('password_hash', 255).notNullable();
        table.string('first_name', 100);
        table.string('last_name', 100);
        table.string('username', 100).unique();
        table.text('profile_image');
        table.boolean('email_verified').defaultTo(false);
        table.string('verification_token', 255);
        table.timestamp('verification_token_expires');
        table.string('reset_password_token', 255);
        table.timestamp('reset_password_expires');
        table.string('refresh_token', 500);
        table.timestamp('last_login');
        table.boolean('is_active').defaultTo(true);
        table.jsonb('preferences').defaultTo('{}');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        table.timestamp('updated_at').defaultTo(knex.fn.now());
        table.timestamp('deleted_at');
        // Indexes for performance
        table.index('email');
        table.index('username');
        table.index(['is_active', 'deleted_at']);
    });
}
async function down(knex) {
    return knex.schema.dropTable('users');
}
