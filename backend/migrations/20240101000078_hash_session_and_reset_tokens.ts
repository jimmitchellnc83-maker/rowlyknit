import type { Knex } from 'knex';

/**
 * Auth + Security Hardening Sprint — store hashes, not raw tokens.
 *
 * Background: `sessions.refresh_token` and `users.reset_password_token`
 * stored the raw token string. Anyone with read access to the database
 * (a leaked backup, a compromised replica) could mint live access
 * tokens or reset arbitrary passwords. Both flows now store only a
 * SHA-256 hash; the raw token leaves the server exactly once (HTTP
 * cookie / email body) and is never persisted.
 *
 * Forward steps:
 *   1. Revoke every existing session. We can't migrate raw → hash
 *      because the raw value is what we're trying to stop storing —
 *      and any operator/backup that had the old value still has it
 *      in plain text. Forcing re-login closes the door cleanly.
 *   2. Add `sessions.refresh_token_hash` (nullable, indexed). Old
 *      rows are revoked above so the null is fine for them.
 *   3. Drop the unique constraint on `sessions.refresh_token` and
 *      drop the column. Postgres lets us do this in one statement
 *      because there are no foreign keys pointing at it.
 *   4. Add `users.reset_password_token_hash` (nullable, indexed).
 *      Clear any pending reset_password_token + reset_password_expires
 *      rows so dangling raw tokens can't be used post-migration.
 *      Drop the raw `reset_password_token` column.
 *
 * Down: recreates the raw columns + index, with no data backfill (we
 * can't recover hash → raw, and we wouldn't want to). Active sessions
 * stay revoked; users will need to log in again. Active password reset
 * requests stay invalid; users will need to request a fresh email.
 */
export async function up(knex: Knex): Promise<void> {
  // Revoke every active session. Documented behavior of this migration:
  // every logged-in user is logged out exactly once during deploy, then
  // the new flow stores only hashes.
  await knex('sessions').update({ is_revoked: true, updated_at: new Date() });

  await knex.schema.alterTable('sessions', (t) => {
    t.string('refresh_token_hash', 128).nullable();
  });

  // Index the new hash column for the WHERE-by-hash lookup the refresh
  // and logout flows perform. Not unique because revoked rows can hold
  // duplicates if a user re-logs in, gets revoked, logs in again — and
  // the hash itself is a SHA-256 of a UUID-pair so collisions are
  // mathematically negligible without a uniqueness constraint anyway.
  await knex.schema.alterTable('sessions', (t) => {
    t.index('refresh_token_hash', 'idx_sessions_refresh_token_hash');
  });

  // Drop the raw token column. Knex's helper drops dependent indexes /
  // unique constraints automatically on Postgres, so the original
  // `unique()` and `index('refresh_token')` come down with it.
  await knex.schema.alterTable('sessions', (t) => {
    t.dropColumn('refresh_token');
  });

  // Same forward path for password reset. Clear in-flight reset rows
  // first so a dangling raw token in the email queue can't be redeemed
  // post-migration.
  await knex('users').update({
    reset_password_token: null,
    reset_password_expires: null,
    updated_at: new Date(),
  });

  await knex.schema.alterTable('users', (t) => {
    t.string('reset_password_token_hash', 128).nullable();
  });

  await knex.schema.alterTable('users', (t) => {
    t.index('reset_password_token_hash', 'idx_users_reset_password_token_hash');
  });

  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('reset_password_token');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (t) => {
    t.dropIndex('reset_password_token_hash', 'idx_users_reset_password_token_hash');
  });

  await knex.schema.alterTable('users', (t) => {
    t.dropColumn('reset_password_token_hash');
  });

  await knex.schema.alterTable('users', (t) => {
    t.string('reset_password_token', 255).nullable();
  });

  await knex.schema.alterTable('sessions', (t) => {
    t.dropIndex('refresh_token_hash', 'idx_sessions_refresh_token_hash');
  });

  await knex.schema.alterTable('sessions', (t) => {
    t.dropColumn('refresh_token_hash');
  });

  // The original column was `notNullable().unique()`. Recreating it as
  // notNullable would fail on the revoked rows we left in the table.
  // Add it as nullable; if the down ever ships, an operator can backfill
  // and re-tighten by hand.
  await knex.schema.alterTable('sessions', (t) => {
    t.string('refresh_token', 500).nullable();
    t.unique('refresh_token');
    t.index('refresh_token');
  });
}
