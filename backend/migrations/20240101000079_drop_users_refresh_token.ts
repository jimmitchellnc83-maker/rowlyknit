import type { Knex } from 'knex';

/**
 * Auth Hygiene Follow-up — drop dead `users.refresh_token` column.
 *
 * Background: `users.refresh_token` was created by the original users
 * migration (`20240101000001_create_users_table.ts`). The session
 * refresh-token flow has always lived on the `sessions` table, never on
 * `users`. PR #379 (migration #078) hashed `sessions.refresh_token` →
 * `sessions.refresh_token_hash`; the `users.refresh_token` column was
 * never read or written by any service, controller, middleware, test,
 * or migration after the table was created.
 *
 * Verification (2026-05-04):
 *   - grep across `backend/src/` and `frontend/src/` for any read or
 *     write of `users.refresh_token` returned only:
 *       - `gdprService.ts` SENSITIVE_COLUMNS scrub list (defense-in-depth)
 *       - regression tests asserting auth flows never write this column
 *   - prod `SELECT COUNT(refresh_token) FROM users` = 0 / 11 users
 *   - Ravelry refresh tokens live on `ravelry_tokens.refresh_token`
 *     (separate table, encrypted) — untouched by this migration.
 *
 * Safety: pure DDL drop, no FKs, no indexes, no app code references.
 *
 * Down: recreates the nullable column. No data restoration possible
 * because no data was ever stored — but the column shape matches the
 * original `varchar(500)` declaration so a hypothetical revert lands
 * the schema in the same state it was in before this migration.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('refresh_token');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.string('refresh_token', 500).nullable();
  });
}
