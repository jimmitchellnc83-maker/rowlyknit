import type { Knex } from 'knex';

/**
 * Populate size_mm from existing size strings where possible.
 * The size_mm column already exists (from the original tools migration).
 * This migration parses existing "US X (Y.Zmm)" strings to fill size_mm.
 */
export async function up(knex: Knex): Promise<void> {
  // Parse mm values from size strings like "0 (2.0mm)", "B/1 (2.25mm)", etc.
  await knex.raw(`
    UPDATE tools
    SET size_mm = CAST(
      substring(size from '(\\d+\\.?\\d*)\\s*mm') AS DECIMAL(5,2)
    )
    WHERE size IS NOT NULL
      AND size_mm IS NULL
      AND size ~ '\\d+\\.?\\d*\\s*mm'
  `);

  // For plain US number sizes without mm, map from known conversions
  const usToMm: Record<string, number> = {
    '000': 1.0, '00': 1.25, '0': 2.0, '1': 2.25, '1.5': 2.5, '2': 2.75,
    '2.5': 3.0, '3': 3.25, '4': 3.5, '5': 3.75, '6': 4.0, '7': 4.5,
    '8': 5.0, '9': 5.5, '10': 6.0, '10.5': 6.5, '10.75': 7.0,
    '11': 8.0, '13': 9.0, '15': 10.0, '17': 12.0, '19': 15.0,
    '35': 19.0, '50': 25.0,
  };

  for (const [us, mm] of Object.entries(usToMm)) {
    // Match "US 7" or just plain number
    await knex.raw(`
      UPDATE tools
      SET size_mm = ?
      WHERE size_mm IS NULL
        AND (
          lower(trim(size)) = lower(?)
          OR lower(trim(size)) = lower(?)
        )
    `, [mm, `US ${us}`, us]);
  }
}

export async function down(_knex: Knex): Promise<void> {
  // Data migration — no structural changes to revert
}
