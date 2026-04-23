import type { Knex } from 'knex';

/**
 * Panel Mode — multi-panel pattern tracking.
 *
 * A `panel_group` binds N panels to a single master counter. Each panel has
 * its own repeat length (e.g. 4, 10, 26 rows); the panel's current row is
 * derived on read from the master counter value, NOT stored. This keeps one
 * write producing N derived positions and avoids the multi-counter drift
 * that haunts KnitCompanion.
 *
 * Panel definitions are project-scoped in v1. A future "copy panels from
 * another project" affordance covers the reuse case without committing to
 * pattern-level definitions.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('panel_groups', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('project_id')
      .notNullable()
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table
      .uuid('master_counter_id')
      .notNullable()
      .references('id')
      .inTable('counters')
      .onDelete('CASCADE');
    table.integer('sort_order').notNullable().defaultTo(0);
    table.jsonb('display_settings').defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.index(['project_id']);
    table.index(['master_counter_id']);
  });

  await knex.schema.createTable('panels', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('panel_group_id')
      .notNullable()
      .references('id')
      .inTable('panel_groups')
      .onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.integer('repeat_length').notNullable();
    table.integer('row_offset').notNullable().defaultTo(0);
    table.integer('sort_order').notNullable().defaultTo(0);
    table.string('display_color', 7).nullable();
    table.boolean('is_collapsed').notNullable().defaultTo(false);
    table.text('notes').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.index(['panel_group_id']);
    table.check('repeat_length > 0');
    table.check('row_offset >= 0');
  });

  await knex.schema.createTable('panel_rows', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('panel_id')
      .notNullable()
      .references('id')
      .inTable('panels')
      .onDelete('CASCADE');
    table.integer('row_number').notNullable();
    table.text('instruction').notNullable();
    table.integer('stitch_count').nullable();
    table.jsonb('metadata').defaultTo('{}');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['panel_id', 'row_number']);
    table.check('row_number > 0');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('panel_rows');
  await knex.schema.dropTableIfExists('panels');
  await knex.schema.dropTableIfExists('panel_groups');
}
