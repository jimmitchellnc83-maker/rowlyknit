import type { Knex } from 'knex';

/**
 * PR #389 review fix — webhook out-of-order protection.
 *
 * Adds `billing_subscriptions.updated_at_provider` (nullable timestamptz)
 * so the upsert path can compare an incoming webhook's
 * `attributes.updated_at` against the last value we stored for the same
 * subscription. An older delivery (e.g. a delayed retry of an earlier
 * `subscription_active`) must not clobber a newer terminal state
 * (`subscription_cancelled`).
 *
 * Why nullable: legacy rows predate this column, and Lemon Squeezy's
 * older webhook envelopes occasionally omit `updated_at`. The service
 * layer treats a missing provider timestamp as "fall through to merge"
 * to preserve current behaviour for those edge cases — the comparison
 * is purely a guard for the case where we DO have both timestamps.
 *
 * Pure additive DDL. Working `down` drops the column.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('billing_subscriptions', (t) => {
    t.timestamp('updated_at_provider', { useTz: true }).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('billing_subscriptions', (t) => {
    t.dropColumn('updated_at_provider');
  });
}
