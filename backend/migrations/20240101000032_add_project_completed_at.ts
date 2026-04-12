import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasCompletedAt = await knex.schema.hasColumn('projects', 'completed_at');
  if (!hasCompletedAt) {
    await knex.schema.alterTable('projects', (table) => {
      table.timestamp('completed_at').nullable();
      table.index(['completed_at'], 'idx_projects_completed_at');
    });
  }

  const hasArchivedAt = await knex.schema.hasColumn('projects', 'archived_at');
  if (!hasArchivedAt) {
    await knex.schema.alterTable('projects', (table) => {
      table.timestamp('archived_at').nullable();
      table.index(['archived_at'], 'idx_projects_archived_at');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasArchivedAt = await knex.schema.hasColumn('projects', 'archived_at');
  if (hasArchivedAt) {
    await knex.schema.alterTable('projects', (table) => {
      table.dropIndex(['archived_at'], 'idx_projects_archived_at');
      table.dropColumn('archived_at');
    });
  }

  const hasCompletedAt = await knex.schema.hasColumn('projects', 'completed_at');
  if (hasCompletedAt) {
    await knex.schema.alterTable('projects', (table) => {
      table.dropIndex(['completed_at'], 'idx_projects_completed_at');
      table.dropColumn('completed_at');
    });
  }
}
