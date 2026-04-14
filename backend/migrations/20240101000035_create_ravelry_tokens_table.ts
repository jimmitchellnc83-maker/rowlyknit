import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('ravelry_tokens', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE').unique();
    table.text('access_token').notNullable();
    table.text('refresh_token').notNullable();
    table.string('token_type', 50).defaultTo('Bearer');
    table.timestamp('expires_at').notNullable();
    table.text('scope').nullable();
    table.string('ravelry_username', 255).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('expires_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('ravelry_tokens');
}
