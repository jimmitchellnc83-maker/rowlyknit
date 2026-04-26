import type { Knex } from 'knex';

/**
 * Adds soft-archive support to the `charts` table for the personal
 * chart library (Session 4 of the Designer roadmap). Existing charts
 * default to `archived_at = NULL` (active). Lists in the UI default to
 * `WHERE archived_at IS NULL` so archived charts disappear from the
 * library view but remain restorable.
 *
 * No data backfill — existing rows are unchanged.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('charts', (t) => {
    t.timestamp('archived_at', { useTz: true }).nullable();
    t.index(['user_id', 'archived_at'], 'idx_charts_user_archived');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('charts', (t) => {
    t.dropIndex(['user_id', 'archived_at'], 'idx_charts_user_archived');
    t.dropColumn('archived_at');
  });
}
