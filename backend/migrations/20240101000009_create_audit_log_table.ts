import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('audit_logs', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.string('action', 100).notNullable(); // create, update, delete, login, etc.
    table.string('entity_type', 100).notNullable(); // user, project, pattern, etc.
    table.uuid('entity_id');
    table.jsonb('old_values');
    table.jsonb('new_values');
    table.string('ip_address', 45);
    table.string('user_agent', 500);
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes for querying logs
    table.index('user_id');
    table.index('entity_type');
    table.index('entity_id');
    table.index(['entity_type', 'entity_id']);
    table.index('created_at');
    table.index(['user_id', 'created_at']);
  });

  // Sessions table for JWT refresh tokens
  return knex.schema.createTable('sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('refresh_token', 500).notNullable().unique();
    table.string('ip_address', 45);
    table.string('user_agent', 500);
    table.timestamp('expires_at').notNullable();
    table.boolean('is_revoked').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('user_id');
    table.index('refresh_token');
    table.index(['user_id', 'is_revoked']);
    table.index('expires_at');
  });

  // Email verification and password reset tokens
  return knex.schema.createTable('tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('token', 500).notNullable().unique();
    table.string('type', 50).notNullable(); // email_verification, password_reset
    table.timestamp('expires_at').notNullable();
    table.boolean('is_used').defaultTo(false);
    table.timestamp('used_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('user_id');
    table.index('token');
    table.index(['type', 'is_used']);
    table.index('expires_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('tokens');
  await knex.schema.dropTable('sessions');
  return knex.schema.dropTable('audit_logs');
}
