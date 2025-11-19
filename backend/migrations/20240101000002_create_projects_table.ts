import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('projects', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.text('description');
    table.string('status', 50).defaultTo('active'); // active, paused, completed, archived
    table.string('project_type', 100); // sweater, scarf, blanket, socks, etc.
    table.date('start_date');
    table.date('target_completion_date');
    table.date('actual_completion_date');
    table.text('notes');
    table.jsonb('metadata').defaultTo('{}'); // gauge, needles, dimensions, etc.
    table.jsonb('tags').defaultTo('[]');
    table.integer('progress_percentage').defaultTo(0);
    table.text('thumbnail_url');
    table.integer('view_count').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at');

    // Indexes
    table.index('user_id');
    table.index('status');
    table.index(['user_id', 'status']);
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('projects');
}
