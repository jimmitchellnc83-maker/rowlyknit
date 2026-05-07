import type { Knex } from 'knex';

/**
 * Allow `usage_events.user_id` to be NULL so we can record events from
 * unauthenticated public-tool sessions.
 *
 * The dashboard's funnel section reads `public_tool_viewed`,
 * `public_tool_used`, and `save_to_rowly_clicked` events from this
 * table. Until now those events fired only into Plausible — the
 * server-side `usage_events` table required a user id, so anonymous
 * calculator visitors were uncountable on the dashboard. We now expose
 * a public POST endpoint that drops a row with `user_id = NULL` for
 * anonymous events; authenticated calls (still the majority) continue
 * to set it.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('usage_events', (table) => {
    table.uuid('user_id').nullable().alter();
  });
}

export async function down(knex: Knex): Promise<void> {
  // Reverting requires every NULL row to be deleted first, otherwise the
  // NOT NULL alter will fail. Anonymous events are best-effort
  // telemetry; deleting them on rollback is acceptable.
  await knex('usage_events').whereNull('user_id').del();
  await knex.schema.alterTable('usage_events', (table) => {
    table.uuid('user_id').notNullable().alter();
  });
}
