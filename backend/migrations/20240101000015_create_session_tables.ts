import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Knitting sessions table
  await knex.schema.createTable('knitting_sessions', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.timestamp('start_time').notNullable();
    table.timestamp('end_time').nullable();
    table.integer('duration_seconds').nullable();
    table.integer('rows_completed').defaultTo(0);
    table.jsonb('starting_counter_values').nullable();
    table.jsonb('ending_counter_values').nullable();
    table.text('notes').nullable();
    table.string('mood', 50).nullable(); // 'productive', 'frustrated', 'relaxed'
    table.string('location', 100).nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('project_id');
    table.index('user_id');
    table.index('start_time');
    table.index(['project_id', 'start_time']);
  });

  // Project milestones table
  await knex.schema.createTable('project_milestones', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.string('name', 255).notNullable(); // "Ribbing", "Body", "Sleeves"
    table.integer('target_rows').nullable();
    table.integer('actual_rows').nullable();
    table.integer('time_spent_seconds').defaultTo(0);
    table.timestamp('completed_at').nullable();
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('project_id');
    table.index(['project_id', 'sort_order']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('project_milestones');
  await knex.schema.dropTable('knitting_sessions');
}
