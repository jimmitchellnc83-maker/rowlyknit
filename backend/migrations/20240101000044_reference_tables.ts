import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Create ref_tool_sizes table
  await knex.schema.createTable('ref_tool_sizes', (table) => {
    table.increments('id').primary();
    table.string('craft_type', 20).notNullable();
    table.string('tool_category', 40).notNullable();
    table.string('hook_family', 20).nullable();
    table.decimal('size_mm', 5, 2).notNullable();
    table.string('us_label', 20).nullable();
    table.string('uk_label', 20).nullable();
    table.string('letter_label', 10).nullable();
    table.integer('sort_order').notNullable().defaultTo(0);

    table.unique(['craft_type', 'tool_category', 'size_mm']);
  });

  // Create ref_circular_lengths table
  await knex.schema.createTable('ref_circular_lengths', (table) => {
    table.increments('id').primary();
    table.decimal('length_mm', 7, 1).notNullable();
    table.integer('sort_order').notNullable().defaultTo(0);
  });

  // Create ref_yarn_weight_categories table
  await knex.schema.createTable('ref_yarn_weight_categories', (table) => {
    table.increments('id').primary();
    table.integer('number').notNullable().unique();
    table.string('name', 30).notNullable();
    table.specificType('aliases', 'text[]').notNullable().defaultTo('{}');
    table.integer('wpi_min').nullable();
    table.integer('wpi_max').nullable();
    table.integer('knit_gauge_4in_min').nullable();
    table.integer('knit_gauge_4in_max').nullable();
    table.integer('crochet_gauge_4in_min').nullable();
    table.integer('crochet_gauge_4in_max').nullable();
    table.decimal('needle_mm_min', 5, 2).nullable();
    table.decimal('needle_mm_max', 5, 2).nullable();
    table.decimal('hook_mm_min', 5, 2).nullable();
    table.decimal('hook_mm_max', 5, 2).nullable();
    table.boolean('advisory_only').notNullable().defaultTo(true);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('ref_yarn_weight_categories');
  await knex.schema.dropTable('ref_circular_lengths');
  await knex.schema.dropTable('ref_tool_sizes');
}
