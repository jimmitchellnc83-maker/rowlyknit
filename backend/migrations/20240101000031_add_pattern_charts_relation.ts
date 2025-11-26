import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasPatternId = await knex.schema.hasColumn('charts', 'pattern_id');

  if (!hasPatternId) {
    await knex.schema.alterTable('charts', (table) => {
      table.uuid('pattern_id').nullable().references('id').inTable('patterns').onDelete('SET NULL');
      table.index(['pattern_id'], 'idx_charts_pattern');
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasPatternId = await knex.schema.hasColumn('charts', 'pattern_id');

  if (hasPatternId) {
    await knex.schema.alterTable('charts', (table) => {
      table.dropIndex(['pattern_id'], 'idx_charts_pattern');
      table.dropColumn('pattern_id');
    });
  }
}
