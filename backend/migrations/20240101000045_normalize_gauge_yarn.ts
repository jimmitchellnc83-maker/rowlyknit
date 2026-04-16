import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add metric gauge columns to projects
  await knex.schema.alterTable('projects', (table) => {
    table.decimal('stitches_per_10cm', 5, 1).nullable();
    table.decimal('rows_per_10cm', 5, 1).nullable();
  });

  // Backfill stitches_per_10cm from pattern gauge (inches to 10cm)
  await knex.raw(`
    UPDATE projects
    SET stitches_per_10cm = pattern_gauge_stitches * (10.0 / (pattern_gauge_measurement * 2.54))
    WHERE pattern_gauge_stitches IS NOT NULL
  `);

  // Backfill rows_per_10cm from pattern gauge (inches to 10cm)
  await knex.raw(`
    UPDATE projects
    SET rows_per_10cm = pattern_gauge_rows * (10.0 / (pattern_gauge_measurement * 2.54))
    WHERE pattern_gauge_rows IS NOT NULL
  `);

  // Add metric length columns to yarn
  await knex.schema.alterTable('yarn', (table) => {
    table.decimal('total_length_m', 10, 1).nullable();
    table.decimal('remaining_length_m', 10, 1).nullable();
  });

  // Backfill total_length_m from yards
  await knex.raw(`
    UPDATE yarn
    SET total_length_m = yards_total * 0.9144
    WHERE yards_total IS NOT NULL
  `);

  // Backfill remaining_length_m from yards
  await knex.raw(`
    UPDATE yarn
    SET remaining_length_m = yards_remaining * 0.9144
    WHERE yards_remaining IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('yarn', (table) => {
    table.dropColumn('remaining_length_m');
    table.dropColumn('total_length_m');
  });

  await knex.schema.alterTable('projects', (table) => {
    table.dropColumn('rows_per_10cm');
    table.dropColumn('stitches_per_10cm');
  });
}
