import type { Knex } from 'knex';

/**
 * Add chart_data JSONB column to pattern_charts table
 * This allows storing chart cell data directly as JSON instead of
 * requiring UUID references to chart_symbols table
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pattern_charts', (table) => {
    // Add JSONB column to store chart data directly
    // This stores an array of cell data: [{row, col, symbol, name, abbr}, ...]
    table.jsonb('chart_data').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('pattern_charts', (table) => {
    table.dropColumn('chart_data');
  });
}
