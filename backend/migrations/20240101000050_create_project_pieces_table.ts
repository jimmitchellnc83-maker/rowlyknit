import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('project_pieces', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    // type is a free-form short label so users can name pieces however the
    // pattern names them (front, back, left sleeve, collar, panel A, etc.)
    table.string('type', 50).defaultTo('other');
    // status mirrors the simple project lifecycle so progress can roll up
    table.string('status', 32).notNullable().defaultTo('not_started');
    table.text('notes');
    table.integer('sort_order').notNullable().defaultTo(0);
    table.timestamp('started_at');
    table.timestamp('completed_at');
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.index('project_id');
    table.index(['project_id', 'sort_order']);
    table.index(['project_id', 'status']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('project_pieces');
}
