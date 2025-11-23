"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.up = up;
exports.down = down;
async function up(knex) {
    // Data export requests
    await knex.schema.createTable('data_export_requests', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('status', 50).defaultTo('pending'); // pending, processing, completed, failed
        table.string('format', 20).defaultTo('json'); // json, csv
        table.text('download_url');
        table.timestamp('expires_at');
        table.text('error_message');
        table.timestamp('completed_at');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        // Indexes
        table.index('user_id');
        table.index('status');
        table.index(['user_id', 'status']);
    });
    // Account deletion requests
    await knex.schema.createTable('deletion_requests', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
        table.string('status', 50).defaultTo('pending'); // pending, scheduled, completed, cancelled
        table.timestamp('scheduled_for'); // date for actual deletion (grace period)
        table.text('reason');
        table.string('confirmation_token', 500);
        table.timestamp('confirmed_at');
        table.timestamp('completed_at');
        table.timestamp('cancelled_at');
        table.timestamp('created_at').defaultTo(knex.fn.now());
        // Indexes
        table.index('user_id');
        table.index('status');
        table.index('scheduled_for');
    });
    // Cookie consent tracking
    await knex.schema.createTable('consent_records', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
        table.string('consent_type', 100).notNullable(); // analytics, marketing, functional
        table.boolean('granted').notNullable();
        table.string('ip_address', 45);
        table.string('user_agent', 500);
        table.timestamp('created_at').defaultTo(knex.fn.now());
        // Indexes
        table.index('user_id');
        table.index('consent_type');
        table.index(['user_id', 'consent_type']);
    });
    // Email delivery tracking
    return knex.schema.createTable('email_logs', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
        table.string('to_email', 255).notNullable();
        table.string('subject', 500);
        table.string('template', 100); // welcome, password_reset, verification, etc.
        table.string('status', 50).defaultTo('sent'); // sent, delivered, bounced, complained
        table.string('provider_id', 255); // ID from email service provider
        table.text('error_message');
        table.timestamp('sent_at').defaultTo(knex.fn.now());
        table.timestamp('delivered_at');
        table.timestamp('opened_at');
        table.timestamp('bounced_at');
        // Indexes
        table.index('user_id');
        table.index('to_email');
        table.index('status');
        table.index('template');
        table.index('sent_at');
    });
}
async function down(knex) {
    await knex.schema.dropTable('email_logs');
    await knex.schema.dropTable('consent_records');
    await knex.schema.dropTable('deletion_requests');
    return knex.schema.dropTable('data_export_requests');
}
