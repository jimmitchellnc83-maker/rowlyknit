import type { Knex } from 'knex';

const KEY_RENAMES: Array<[from: string, to: string]> = [
  ['lengthUnit', 'lengthDisplayUnit'],
  ['yarnQuantityUnit', 'yarnLengthDisplayUnit'],
  ['yarnWeightUnit', 'weightDisplayUnit'],
];

interface MeasurementsLike {
  [key: string]: unknown;
}

interface PreferencesLike {
  measurements?: MeasurementsLike;
  [key: string]: unknown;
}

/**
 * Migrate `users.preferences.measurements` from the legacy unit field names
 * (`lengthUnit`, `yarnQuantityUnit`, `yarnWeightUnit`) to the new names
 * introduced in PR #230 (`lengthDisplayUnit`, `yarnLengthDisplayUnit`,
 * `weightDisplayUnit`).
 *
 * Read each user, rename keys in JS, write the row back. Earlier attempts
 * built the rename in pure SQL with `jsonb_set` + named bind params; the
 * combination kept hitting Postgres planner ambiguities (`?` bind clash,
 * `unknown - unknown` operator, `'{measurements}'` typed as json instead
 * of text[]). Imperative is unambiguous, idempotent, and the user table is
 * small.
 *
 * Re-running the migration is a no-op for already-migrated rows because
 * the per-key check skips rows without the legacy key.
 */
export async function up(knex: Knex): Promise<void> {
  await renameKeys(knex, KEY_RENAMES);
}

/** Reverse the rename by inverting each pair. */
export async function down(knex: Knex): Promise<void> {
  const inverse = KEY_RENAMES.map(([f, t]) => [t, f] as [string, string]);
  await renameKeys(knex, inverse);
}

async function renameKeys(knex: Knex, pairs: Array<[string, string]>): Promise<void> {
  const rows: Array<{ id: string; preferences: PreferencesLike | null }> = await knex('users')
    .select('id', 'preferences')
    .whereNotNull('preferences');

  for (const row of rows) {
    const prefs: PreferencesLike = row.preferences ?? {};
    const m = prefs.measurements;
    if (!m || typeof m !== 'object') continue;

    let changed = false;
    for (const [fromKey, toKey] of pairs) {
      if (m[fromKey] === undefined) continue;
      if (m[toKey] === undefined) {
        m[toKey] = m[fromKey];
      }
      delete m[fromKey];
      changed = true;
    }

    if (changed) {
      await knex('users').where({ id: row.id }).update({ preferences: prefs });
    }
  }
}
