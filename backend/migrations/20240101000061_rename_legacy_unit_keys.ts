import type { Knex } from 'knex';

/**
 * Migrate `users.preferences.measurements` from the legacy unit field
 * names (`lengthUnit`, `yarnQuantityUnit`, `yarnWeightUnit`) to the new
 * names introduced in PR #230 (`lengthDisplayUnit`, `yarnLengthDisplayUnit`,
 * `weightDisplayUnit`).
 *
 * For each row:
 *   - Copy each legacy value onto its new key, but only if the new key
 *     is missing/null (so prior writes via the new schema win).
 *   - Delete the legacy keys.
 *
 * Values are identical between legacy and new ('in'/'cm'/'mm', 'yd'/'m',
 * 'g'/'oz'), so the copy is a literal rename.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE users
    SET preferences = jsonb_set(
      preferences,
      '{measurements}',
      (
        (preferences->'measurements')
          - 'lengthUnit'
          - 'yarnQuantityUnit'
          - 'yarnWeightUnit'
      )
        || jsonb_build_object(
          'lengthDisplayUnit',
          COALESCE(
            preferences->'measurements'->>'lengthDisplayUnit',
            preferences->'measurements'->>'lengthUnit'
          )
        ) FILTER (WHERE
          preferences->'measurements'->>'lengthDisplayUnit' IS NOT NULL
          OR preferences->'measurements'->>'lengthUnit' IS NOT NULL
        )
        || jsonb_build_object(
          'yarnLengthDisplayUnit',
          COALESCE(
            preferences->'measurements'->>'yarnLengthDisplayUnit',
            preferences->'measurements'->>'yarnQuantityUnit'
          )
        ) FILTER (WHERE
          preferences->'measurements'->>'yarnLengthDisplayUnit' IS NOT NULL
          OR preferences->'measurements'->>'yarnQuantityUnit' IS NOT NULL
        )
        || jsonb_build_object(
          'weightDisplayUnit',
          COALESCE(
            preferences->'measurements'->>'weightDisplayUnit',
            preferences->'measurements'->>'yarnWeightUnit'
          )
        ) FILTER (WHERE
          preferences->'measurements'->>'weightDisplayUnit' IS NOT NULL
          OR preferences->'measurements'->>'yarnWeightUnit' IS NOT NULL
        )
    )
    WHERE preferences ? 'measurements'
      AND (
        preferences->'measurements' ? 'lengthUnit'
        OR preferences->'measurements' ? 'yarnQuantityUnit'
        OR preferences->'measurements' ? 'yarnWeightUnit'
      );
  `);
}

/**
 * Reverse: copy new keys back onto legacy keys (only if legacy is missing),
 * then delete the new keys.
 */
export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE users
    SET preferences = jsonb_set(
      preferences,
      '{measurements}',
      (
        (preferences->'measurements')
          - 'lengthDisplayUnit'
          - 'yarnLengthDisplayUnit'
          - 'weightDisplayUnit'
      )
        || jsonb_build_object(
          'lengthUnit',
          COALESCE(
            preferences->'measurements'->>'lengthUnit',
            preferences->'measurements'->>'lengthDisplayUnit'
          )
        ) FILTER (WHERE
          preferences->'measurements'->>'lengthUnit' IS NOT NULL
          OR preferences->'measurements'->>'lengthDisplayUnit' IS NOT NULL
        )
        || jsonb_build_object(
          'yarnQuantityUnit',
          COALESCE(
            preferences->'measurements'->>'yarnQuantityUnit',
            preferences->'measurements'->>'yarnLengthDisplayUnit'
          )
        ) FILTER (WHERE
          preferences->'measurements'->>'yarnQuantityUnit' IS NOT NULL
          OR preferences->'measurements'->>'yarnLengthDisplayUnit' IS NOT NULL
        )
        || jsonb_build_object(
          'yarnWeightUnit',
          COALESCE(
            preferences->'measurements'->>'yarnWeightUnit',
            preferences->'measurements'->>'weightDisplayUnit'
          )
        ) FILTER (WHERE
          preferences->'measurements'->>'yarnWeightUnit' IS NOT NULL
          OR preferences->'measurements'->>'weightDisplayUnit' IS NOT NULL
        )
    )
    WHERE preferences ? 'measurements'
      AND (
        preferences->'measurements' ? 'lengthDisplayUnit'
        OR preferences->'measurements' ? 'yarnLengthDisplayUnit'
        OR preferences->'measurements' ? 'weightDisplayUnit'
      );
  `);
}
