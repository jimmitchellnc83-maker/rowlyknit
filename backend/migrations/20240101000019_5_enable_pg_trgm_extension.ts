import type { Knex } from 'knex';

/**
 * Enable pg_trgm Extension
 * This extension must be enabled before creating trigram indexes in subsequent migrations
 */

export async function up(knex: Knex): Promise<void> {
  await knex.raw('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP EXTENSION IF EXISTS pg_trgm;');
}
