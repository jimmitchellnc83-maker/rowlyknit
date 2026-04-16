import type { Knex } from 'knex';

/**
 * Ensure audit_logs has proper composite indexes for query performance.
 * The original migration (000009) already creates these indexes, but this
 * migration serves as a safety net in case they were dropped or the original
 * migration was modified.
 */
export async function up(knex: Knex): Promise<void> {
  const hasUserCreatedIdx = await knex.schema.raw(`
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_logs'
    AND indexdef LIKE '%user_id%'
    AND indexdef LIKE '%created_at%'
  `);

  if (hasUserCreatedIdx.rows.length === 0) {
    await knex.schema.table('audit_logs', (table) => {
      table.index(['user_id', 'created_at']);
    });
  }

  const hasEntityIdx = await knex.schema.raw(`
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_logs'
    AND indexdef LIKE '%entity_type%'
    AND indexdef LIKE '%entity_id%'
  `);

  if (hasEntityIdx.rows.length === 0) {
    await knex.schema.table('audit_logs', (table) => {
      table.index(['entity_type', 'entity_id']);
    });
  }

  const hasCreatedAtIdx = await knex.schema.raw(`
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'audit_logs'
    AND indexname LIKE '%created_at%'
    AND indexdef NOT LIKE '%user_id%'
    AND indexdef NOT LIKE '%entity%'
  `);

  if (hasCreatedAtIdx.rows.length === 0) {
    await knex.schema.table('audit_logs', (table) => {
      table.index('created_at');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  // Don't drop indexes in down — they may have been created by migration 000009
  // and dropping them here could leave the DB in a bad state.
}
