import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('yarn_photos', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('yarn_id').notNullable().references('id').inTable('yarn').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('filename', 255).notNullable();
    table.string('thumbnail_filename', 255).notNullable();
    table.string('original_filename', 255).notNullable();
    table.string('file_path', 500).notNullable();
    table.string('thumbnail_path', 500).notNullable();
    table.string('mime_type', 100);
    table.integer('size'); // File size in bytes
    table.integer('width'); // Image width
    table.integer('height'); // Image height
    table.text('caption'); // Optional caption
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_primary').defaultTo(false); // Primary yarn photo
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at'); // Soft delete

    // Indexes
    table.index('yarn_id');
    table.index('user_id');
    table.index(['yarn_id', 'sort_order']);
    table.index(['yarn_id', 'is_primary']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('yarn_photos');
}
