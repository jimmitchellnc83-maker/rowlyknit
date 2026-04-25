import type { Knex } from 'knex';

/**
 * Captures what a new registrant said they want to do first in Rowly:
 * track an active project, organize their stash, follow a pattern,
 * design something new, or just explore the example data. Drives the
 * post-registration goal card on Dashboard and the routing decision
 * after a goal is picked. Nullable because every existing user
 * pre-dates this question and skipping the card defaults to
 * `track_project` at the application layer (not in the DB).
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.text('onboarding_goal').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('onboarding_goal');
  });
}
