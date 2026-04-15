import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('yarn', (table) => {
    table.text('gauge').nullable();
    table.text('needle_sizes').nullable();
    table.boolean('machine_washable').nullable();
    table.boolean('discontinued').defaultTo(false);
    table.integer('ravelry_id').nullable();
    table.decimal('ravelry_rating', 3, 2).nullable();
    table.text('description').nullable();

    table.index('ravelry_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('yarn', (table) => {
    table.dropColumn('gauge');
    table.dropColumn('needle_sizes');
    table.dropColumn('machine_washable');
    table.dropColumn('discontinued');
    table.dropColumn('ravelry_id');
    table.dropColumn('ravelry_rating');
    table.dropColumn('description');
  });
}
