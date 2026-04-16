import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Add canonical columns to tools table
  await knex.schema.alterTable('tools', (table) => {
    table.string('craft_type', 20).notNullable().defaultTo('knitting');
    table.string('tool_category', 40).nullable();
    table.decimal('cable_length_mm', 7, 1).nullable();
  });

  // Backfill craft_type
  await knex.raw(`UPDATE tools SET craft_type = 'crochet' WHERE category = 'crochet_hooks'`);
  await knex.raw(`UPDATE tools SET craft_type = 'knitting' WHERE craft_type != 'crochet'`);

  // Backfill tool_category from type
  await knex.raw(`UPDATE tools SET tool_category = 'knitting_needle_circular' WHERE type = 'circular_needle'`);
  await knex.raw(`UPDATE tools SET tool_category = 'knitting_needle_dpn' WHERE type = 'dpn'`);
  await knex.raw(`UPDATE tools SET tool_category = 'knitting_needle_straight' WHERE type = 'straight_needle'`);
  await knex.raw(`
    UPDATE tools SET tool_category = 'crochet_hook_standard'
    WHERE type IN ('standard_hook', 'ergonomic_hook', 'tunisian_hook')
  `);
  await knex.raw(`UPDATE tools SET tool_category = 'crochet_hook_steel' WHERE type = 'steel_hook'`);
  await knex.raw(`UPDATE tools SET tool_category = 'accessory' WHERE tool_category IS NULL`);

  // Backfill cable_length_mm from length (inches to mm)
  await knex.raw(`
    UPDATE tools
    SET cable_length_mm = length * 25.4
    WHERE length IS NOT NULL
  `);

  // Add indexes
  await knex.schema.alterTable('tools', (table) => {
    table.index('craft_type');
    table.index('tool_category');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tools', (table) => {
    table.dropIndex('tool_category');
    table.dropIndex('craft_type');
    table.dropColumn('cable_length_mm');
    table.dropColumn('tool_category');
    table.dropColumn('craft_type');
  });
}
