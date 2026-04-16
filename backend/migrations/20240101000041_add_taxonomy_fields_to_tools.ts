import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tools', (table) => {
    // Links user's tool to the canonical taxonomy type
    table.string('taxonomy_type_id', 60).references('id').inTable('tool_taxonomy_types').onDelete('SET NULL');
    // Denormalized labels for fast display without joins
    table.string('taxonomy_label', 150);
    table.string('taxonomy_category_label', 120);
    table.string('taxonomy_subcategory_label', 120);

    table.index('taxonomy_type_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('tools', (table) => {
    table.dropIndex('taxonomy_type_id');
    table.dropColumn('taxonomy_subcategory_label');
    table.dropColumn('taxonomy_category_label');
    table.dropColumn('taxonomy_label');
    table.dropColumn('taxonomy_type_id');
  });
}
