import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add check constraints to prevent negative yarn values
  await knex.raw(`
    ALTER TABLE yarn
    ADD CONSTRAINT yarn_yards_remaining_non_negative
    CHECK (yards_remaining >= 0);
  `);

  await knex.raw(`
    ALTER TABLE yarn
    ADD CONSTRAINT yarn_skeins_remaining_non_negative
    CHECK (skeins_remaining >= 0);
  `);

  await knex.raw(`
    ALTER TABLE yarn
    ADD CONSTRAINT yarn_grams_remaining_non_negative
    CHECK (grams_remaining IS NULL OR grams_remaining >= 0);
  `);
}

export async function down(knex: Knex): Promise<void> {
  // Remove check constraints
  await knex.raw(`
    ALTER TABLE yarn
    DROP CONSTRAINT IF EXISTS yarn_yards_remaining_non_negative;
  `);

  await knex.raw(`
    ALTER TABLE yarn
    DROP CONSTRAINT IF EXISTS yarn_skeins_remaining_non_negative;
  `);

  await knex.raw(`
    ALTER TABLE yarn
    DROP CONSTRAINT IF EXISTS yarn_grams_remaining_non_negative;
  `);
}
