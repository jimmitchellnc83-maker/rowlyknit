import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add hierarchy and auto-reset columns to counters table
  await knex.schema.alterTable('counters', (table) => {
    // Parent counter for nesting/hierarchy
    table.uuid('parent_counter_id')
      .nullable()
      .references('id')
      .inTable('counters')
      .onDelete('SET NULL');

    // Auto-reset when target is reached
    table.boolean('auto_reset').defaultTo(false);

    // Index for efficient parent lookups
    table.index('parent_counter_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('counters', (table) => {
    table.dropIndex('parent_counter_id');
    table.dropColumn('auto_reset');
    table.dropColumn('parent_counter_id');
  });
}
