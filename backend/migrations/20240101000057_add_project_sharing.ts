import type { Knex } from 'knex';

// Adds per-project public sharing — see PR description for the design.
// share_slug is generated lazily on first publish and stays stable so a
// shared link doesn't break if the project is unpublished and republished.
// Partial index keeps the lookup cheap without bloating with private rows.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('projects', (table) => {
    table.boolean('is_public').notNullable().defaultTo(false);
    table.text('share_slug').unique();
    table.timestamp('published_at');
  });

  await knex.raw(
    'CREATE INDEX IF NOT EXISTS projects_share_slug_public_idx ON projects (share_slug) WHERE is_public = true',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS projects_share_slug_public_idx');
  await knex.schema.alterTable('projects', (table) => {
    table.dropColumn('published_at');
    table.dropColumn('share_slug');
    table.dropColumn('is_public');
  });
}
