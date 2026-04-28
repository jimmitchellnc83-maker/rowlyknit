import type { Knex } from 'knex';

/**
 * Add public-share columns to `pattern_models` so a canonical Pattern
 * can be published behind a stable URL the way `/p/:slug` works for
 * projects (see migration #057 for the project equivalent).
 *
 * Mirrors the project sharing schema field-for-field:
 *   - `is_public boolean NOT NULL DEFAULT false`
 *   - `share_slug text UNIQUE` — generated lazily on first publish,
 *     remains stable across publish/unpublish cycles
 *   - `published_at timestamptz` — NULL until first publish, retained
 *     after unpublish so analytics can read the original date
 *
 * Partial index keeps slug lookups cheap on the public path without
 * bloating with private rows.
 *
 * Backfill: NULL slug + is_public=false for every existing row. No
 * pattern has been "published" yet (this is the first publishing
 * surface for canonical patterns), so there is nothing to migrate
 * forward.
 *
 * Note: scope intentionally narrow. This migration ships the columns;
 * the slug generator service + `/p/pattern/:slug` public view + Author
 * mode publish toggle land in a follow-up. The columns standing alone
 * are safe — nothing reads them until those features ship.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pattern_models', (table) => {
    table.boolean('is_public').notNullable().defaultTo(false);
    table.text('share_slug').unique();
    table.timestamp('published_at');
  });

  await knex.raw(
    'CREATE INDEX IF NOT EXISTS pattern_models_share_slug_public_idx ON pattern_models (share_slug) WHERE is_public = true',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS pattern_models_share_slug_public_idx');
  await knex.schema.alterTable('pattern_models', (table) => {
    table.dropColumn('published_at');
    table.dropColumn('share_slug');
    table.dropColumn('is_public');
  });
}
