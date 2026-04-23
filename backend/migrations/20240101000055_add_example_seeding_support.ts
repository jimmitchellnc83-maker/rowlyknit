import type { Knex } from 'knex';

/**
 * Example-data seeding support.
 *
 * We seed a showcase dataset for every new registrant so the app isn't empty
 * on first login — yarn stash, patterns, tools, recipient, and a few projects
 * (one fully wired with Panel Mode + counters + sessions + markers).
 *
 * `is_example` lets the user nuke the showcase in one tap from Profile
 * without touching anything they created themselves. Only the root
 * user-owned entities need the flag — children (counters, panel_groups,
 * panel_rows, markers, sessions, pieces, ratings, photos, notes) cascade
 * when their parent project is deleted.
 *
 * `users.tour_completed_at` + `users.examples_seeded_at` + `users.examples_cleared_at`
 * let the client decide whether to show the guided tour and whether to
 * offer the "Clear example data" button.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('projects', (table) => {
    table.boolean('is_example').notNullable().defaultTo(false);
    table.index(['user_id', 'is_example']);
  });

  await knex.schema.alterTable('yarn', (table) => {
    table.boolean('is_example').notNullable().defaultTo(false);
    table.index(['user_id', 'is_example']);
  });

  await knex.schema.alterTable('patterns', (table) => {
    table.boolean('is_example').notNullable().defaultTo(false);
    table.index(['user_id', 'is_example']);
  });

  await knex.schema.alterTable('tools', (table) => {
    table.boolean('is_example').notNullable().defaultTo(false);
    table.index(['user_id', 'is_example']);
  });

  await knex.schema.alterTable('recipients', (table) => {
    table.boolean('is_example').notNullable().defaultTo(false);
    table.index(['user_id', 'is_example']);
  });

  await knex.schema.alterTable('users', (table) => {
    table.timestamp('examples_seeded_at').nullable();
    table.timestamp('examples_cleared_at').nullable();
    table.timestamp('tour_completed_at').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('projects', (table) => {
    table.dropIndex(['user_id', 'is_example']);
    table.dropColumn('is_example');
  });
  await knex.schema.alterTable('yarn', (table) => {
    table.dropIndex(['user_id', 'is_example']);
    table.dropColumn('is_example');
  });
  await knex.schema.alterTable('patterns', (table) => {
    table.dropIndex(['user_id', 'is_example']);
    table.dropColumn('is_example');
  });
  await knex.schema.alterTable('tools', (table) => {
    table.dropIndex(['user_id', 'is_example']);
    table.dropColumn('is_example');
  });
  await knex.schema.alterTable('recipients', (table) => {
    table.dropIndex(['user_id', 'is_example']);
    table.dropColumn('is_example');
  });
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('examples_seeded_at');
    table.dropColumn('examples_cleared_at');
    table.dropColumn('tour_completed_at');
  });
}
