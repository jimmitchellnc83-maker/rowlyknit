import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Track shared charts
  await knex.schema.createTable('shared_charts', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('chart_id').references('id').inTable('charts').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('share_token', 100).unique().notNullable();
    table.string('visibility', 20).defaultTo('public'); // public, private
    table.boolean('allow_copy').defaultTo(false);
    table.boolean('allow_download').defaultTo(true);
    table.integer('view_count').defaultTo(0);
    table.integer('copy_count').defaultTo(0);
    table.integer('download_count').defaultTo(0);
    table.string('password_hash', 255).nullable(); // Optional password protection
    table.timestamp('expires_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('last_viewed_at').nullable();

    table.index('share_token', 'idx_shared_charts_token');
    table.index('user_id', 'idx_shared_charts_user');
    table.index('chart_id', 'idx_shared_charts_chart');
  });

  // Track export history
  await knex.schema.createTable('export_history', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.uuid('chart_id').references('id').inTable('charts').onDelete('SET NULL').nullable();
    table.uuid('project_id').references('id').inTable('projects').onDelete('SET NULL').nullable();
    table.uuid('pattern_id').references('id').inTable('patterns').onDelete('SET NULL').nullable();
    table.string('export_type', 50).notNullable(); // chart, pattern, project
    table.string('export_format', 20).notNullable(); // pdf, png, csv, ravelry, markdown
    table.jsonb('export_options').defaultTo('{}');
    table.string('file_url', 500).nullable();
    table.integer('file_size_bytes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('user_id', 'idx_export_history_user');
  });

  // Track shared pattern links
  await knex.schema.createTable('shared_patterns', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('pattern_id').references('id').inTable('patterns').onDelete('CASCADE');
    table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.string('share_token', 100).unique().notNullable();
    table.string('visibility', 20).defaultTo('public');
    table.boolean('allow_copy').defaultTo(false);
    table.boolean('include_charts').defaultTo(true);
    table.boolean('include_notes').defaultTo(false);
    table.integer('view_count').defaultTo(0);
    table.timestamp('expires_at').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());

    table.index('share_token', 'idx_shared_patterns_token');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('shared_patterns');
  await knex.schema.dropTableIfExists('export_history');
  await knex.schema.dropTableIfExists('shared_charts');
}
