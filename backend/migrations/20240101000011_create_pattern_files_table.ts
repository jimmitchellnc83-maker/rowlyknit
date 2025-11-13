import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('pattern_files', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('pattern_id').notNullable().references('id').inTable('patterns').onDelete('CASCADE');
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('filename', 255).notNullable();
    table.string('original_filename', 255).notNullable();
    table.string('file_path', 500).notNullable();
    table.string('mime_type', 100);
    table.integer('size'); // File size in bytes
    table.enum('file_type', ['pdf', 'image', 'document', 'other']).defaultTo('other');
    table.text('description'); // Optional description of the file
    table.integer('sort_order').defaultTo(0);
    table.boolean('is_primary').defaultTo(false); // Mark primary pattern file
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at'); // Soft delete

    // Indexes
    table.index('pattern_id');
    table.index('user_id');
    table.index(['pattern_id', 'sort_order']);
    table.index(['pattern_id', 'is_primary']);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('pattern_files');
}
