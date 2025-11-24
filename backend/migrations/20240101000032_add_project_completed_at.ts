import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add completed_at column if it doesn't exist
  const hasCompletedAt = await knex.schema.hasColumn('projects', 'completed_at');
  if (!hasCompletedAt) {
    await knex.schema.alterTable('projects', (table) => {
      table.timestamp('completed_at').nullable();
    });

    // Set completed_at for existing completed projects
    await knex('projects')
      .where({ status: 'completed' })
      .whereNull('completed_at')
      .update({ completed_at: knex.fn.now() });
  }

  // Add deleted_at column if it doesn't exist (for soft deletes)
  const hasDeletedAt = await knex.schema.hasColumn('projects', 'deleted_at');
  if (!hasDeletedAt) {
    await knex.schema.alterTable('projects', (table) => {
      table.timestamp('deleted_at').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('projects', (table) => {
    table.dropColumn('completed_at');
    table.dropColumn('deleted_at');
  });
}
