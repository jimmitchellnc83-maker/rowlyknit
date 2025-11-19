import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('project_photos', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.string('filename', 255).notNullable();
    table.string('thumbnail_filename', 255).notNullable();
    table.string('original_filename', 255).notNullable();
    table.string('file_path', 500).notNullable();
    table.string('thumbnail_path', 500).notNullable();
    table.string('mime_type', 100);
    table.integer('size');
    table.integer('width');
    table.integer('height');
    table.text('caption');
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_primary').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at');

    // Indexes
    table.index('project_id');
    table.index(['project_id', 'sort_order']);
    table.index(['project_id', 'is_primary']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('project_photos');
}
