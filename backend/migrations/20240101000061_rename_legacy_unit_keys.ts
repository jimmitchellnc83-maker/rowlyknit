import type { Knex } from 'knex';

/**
 * Migrate `users.preferences.measurements` from the legacy unit field
 * names (`lengthUnit`, `yarnQuantityUnit`, `yarnWeightUnit`) to the new
 * names introduced in PR #230 (`lengthDisplayUnit`, `yarnLengthDisplayUnit`,
 * `weightDisplayUnit`).
 *
 * Strategy: for each legacy key, an UPDATE that
 *   1. Copies the legacy value onto the new key, but only when the new key
 *      is missing (so prior writes via the new schema win).
 *   2. Removes the legacy key.
 *
 * Each UPDATE only touches rows that actually have the legacy key, so a
 * second migration run is a no-op. Values are identical between legacy and
 * new ('in'/'cm'/'mm', 'yd'/'m', 'g'/'oz'), so the copy is a literal rename.
 *
 * Note: we deliberately avoid Postgres's JSONB `?` operator because
 * knex.raw() interprets `?` as a bind placeholder. `(jsonb ->> 'key')
 * IS NOT NULL` is the equivalent membership check.
 */
export async function up(knex: Knex): Promise<void> {
  await renameKey(knex, 'lengthUnit', 'lengthDisplayUnit');
  await renameKey(knex, 'yarnQuantityUnit', 'yarnLengthDisplayUnit');
  await renameKey(knex, 'yarnWeightUnit', 'weightDisplayUnit');
}

/**
 * Reverse: copy new keys back onto legacy keys (only when the legacy key
 * is missing), then delete the new keys.
 */
export async function down(knex: Knex): Promise<void> {
  await renameKey(knex, 'lengthDisplayUnit', 'lengthUnit');
  await renameKey(knex, 'yarnLengthDisplayUnit', 'yarnQuantityUnit');
  await renameKey(knex, 'weightDisplayUnit', 'yarnWeightUnit');
}

async function renameKey(knex: Knex, fromKey: string, toKey: string): Promise<void> {
  await knex.raw(
    `
    UPDATE users
    SET preferences = jsonb_set(
      preferences,
      '{measurements}',
      (preferences -> 'measurements' - :fromKey)
        || jsonb_build_object(
          :toKey,
          COALESCE(
            preferences -> 'measurements' ->> :toKey,
            preferences -> 'measurements' ->> :fromKey
          )
        )
    )
    WHERE preferences -> 'measurements' ->> :fromKey IS NOT NULL
    `,
    { fromKey, toKey },
  );
}
