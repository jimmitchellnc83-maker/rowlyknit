import type { Knex } from 'knex';

/**
 * Add `is_favorite` boolean column to `projects` so users can star priority
 * / finished projects from the grid view. Mirrors the pattern used by
 * `patterns.is_favorite` (migration 000005) and `yarn.is_favorite` (000006).
 *
 * Idempotent: prod may already have the column if an earlier out-of-band
 * migration touched it (same class of drift as the ravelry_id case in 000047).
 */
export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasColumn('projects', 'is_favorite'))) {
    await knex.schema.alterTable('projects', (table) => {
      table.boolean('is_favorite').notNullable().defaultTo(false);
    });
  }

  const indexResult = await knex.raw(
    `SELECT 1 FROM pg_indexes WHERE tablename = 'projects' AND indexname = 'projects_user_id_is_favorite_index'`
  );
  if (indexResult.rows.length === 0) {
    await knex.schema.alterTable('projects', (table) => {
      table.index(['user_id', 'is_favorite']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('projects', 'is_favorite')) {
    await knex.schema.alterTable('projects', (table) => {
      table.dropIndex(['user_id', 'is_favorite']);
      table.dropColumn('is_favorite');
    });
  }
}
