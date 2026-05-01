import { Knex } from 'knex';

// Optional WPI (wraps per inch) on yarn rows. Nullable; when not set, the
// app falls back to the CYC-published default range for the yarn's weight
// category (see frontend/src/utils/yarnWpi.ts + backend/src/types/yarnWpi.ts).

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('yarn', (table) => {
    table.decimal('wpi', 4, 1).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('yarn', (table) => {
    table.dropColumn('wpi');
  });
}
