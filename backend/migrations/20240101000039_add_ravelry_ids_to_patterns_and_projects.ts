import type { Knex } from 'knex';

/**
 * Add ravelry_id columns to patterns and projects so bulk imports can dedupe.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('patterns', (table) => {
    table.integer('ravelry_id').nullable();
    table.index('ravelry_id');
  });

  await knex.schema.alterTable('projects', (table) => {
    table.integer('ravelry_id').nullable();
    table.index('ravelry_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('patterns', (table) => {
    table.dropColumn('ravelry_id');
  });
  await knex.schema.alterTable('projects', (table) => {
    table.dropColumn('ravelry_id');
  });
}
