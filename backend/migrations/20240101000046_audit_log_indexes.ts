import type { Knex } from 'knex';

/**
 * Ensure audit_logs has proper composite indexes for query performance.
 * The original migration (000009) already creates these indexes, but this
 * migration serves as a safety net in case they were dropped or the original
 * migration was modified.
 */
export async function up(knex: Knex): Promise<void> {
  const result = await knex.raw(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'audit_logs'
  `);
  const existingIndexes = (result.rows as Array<{ indexname: string }>).map(r => r.indexname);

  const hasUserCreatedIdx = existingIndexes.some(
    name => name.includes('user_id') && name.includes('created_at')
  );
  if (!hasUserCreatedIdx) {
    await knex.schema.table('audit_logs', (table) => {
      table.index(['user_id', 'created_at']);
    });
  }

  const hasEntityIdx = existingIndexes.some(
    name => name.includes('entity_type') && name.includes('entity_id')
  );
  if (!hasEntityIdx) {
    await knex.schema.table('audit_logs', (table) => {
      table.index(['entity_type', 'entity_id']);
    });
  }

  const hasCreatedAtOnly = existingIndexes.some(
    name => name.includes('created_at') && !name.includes('user_id') && !name.includes('entity')
  );
  if (!hasCreatedAtOnly) {
    await knex.schema.table('audit_logs', (table) => {
      table.index('created_at');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Don't drop indexes in down — they may have been created by migration 000009
}
