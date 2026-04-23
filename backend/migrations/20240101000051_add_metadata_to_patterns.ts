import type { Knex } from 'knex';

/**
 * Add a JSONB `metadata` column to patterns. Mirrors the shape already
 * present on projects (see 20240101000002_create_projects_table) so a
 * pattern can carry arbitrary ancillary data — most immediately, a
 * DesignerFormSnapshot saved via the Pattern Designer's "Save as pattern"
 * button, but also room for future features like chart linkage, yarn-color
 * requirements, or published-pattern analytics.
 *
 * Nullable + default '{}' so existing rows remain untouched and legacy
 * writers that omit the field keep working.
 */
export async function up(knex: Knex): Promise<void> {
  return knex.schema.alterTable('patterns', (table) => {
    table.jsonb('metadata').defaultTo('{}');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.alterTable('patterns', (table) => {
    table.dropColumn('metadata');
  });
}
