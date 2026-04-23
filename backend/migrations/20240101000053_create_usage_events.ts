import type { Knex } from 'knex';

/**
 * Lightweight usage-event log for the "do we keep this feature?" question.
 *
 * Four components (GradientDesigner, HandwrittenNotes, BlogImportModal,
 * ChartImageUpload) are flagged as pruning candidates pending actual-usage
 * data. We log one event per meaningful user action ("saved", "imported")
 * — not "opened" — so accidental clicks don't inflate numbers.
 *
 * Intentionally minimal: no batching, no offline queue, no PII.
 * `metadata` is a catch-all jsonb for later-added dimensions.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('usage_events', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('event_name', 64).notNullable();
    table.uuid('entity_id').nullable();
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['event_name', 'created_at']);
    table.index(['user_id', 'event_name']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('usage_events');
}
