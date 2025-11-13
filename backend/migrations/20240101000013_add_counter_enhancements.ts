import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add new columns to counters table
  await knex.schema.alterTable('counters', (table) => {
    table.string('display_color', 7).defaultTo('#3B82F6'); // Hex color for visual distinction
    table.boolean('is_visible').defaultTo(true); // Show/hide counter
    table.jsonb('increment_pattern').nullable(); // Custom increment patterns
  });

  // Add user_note to counter_history for context
  await knex.schema.alterTable('counter_history', (table) => {
    table.text('user_note').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('counters', (table) => {
    table.dropColumn('display_color');
    table.dropColumn('is_visible');
    table.dropColumn('increment_pattern');
  });

  await knex.schema.alterTable('counter_history', (table) => {
    table.dropColumn('user_note');
  });
}
