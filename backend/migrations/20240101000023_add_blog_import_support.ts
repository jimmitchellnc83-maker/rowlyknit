import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Enhance patterns table with import tracking columns
  await knex.schema.alterTable('patterns', (table) => {
    // Source type: 'manual' (user entered), 'blog_import' (scraped from URL), 'ravelry_import', etc.
    table.string('source_type', 50).defaultTo('manual');
    // Timestamp when the pattern was imported
    table.timestamp('imported_at').nullable();
    // Store original raw content for reference
    table.text('original_content').nullable();
  });

  // Create pattern_imports table for tracking import attempts
  await knex.schema.createTable('pattern_imports', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.uuid('pattern_id').nullable().references('id').inTable('patterns').onDelete('CASCADE');
    table.text('source_url').notNullable();
    table.text('raw_content').nullable(); // Original HTML/content before extraction
    table.text('extracted_content').nullable(); // Cleaned readable content
    table.string('page_title', 500).nullable();
    table.jsonb('extraction_metadata').nullable(); // Readability metadata, extraction info
    table.boolean('success').defaultTo(true);
    table.text('error_message').nullable();
    table.string('status', 50).defaultTo('pending'); // 'pending', 'extracted', 'reviewed', 'saved', 'failed'
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('user_id');
    table.index('pattern_id');
    table.index('status');
    table.index('created_at');
  });

  // Add index on patterns table for source_type filtering
  await knex.schema.alterTable('patterns', (table) => {
    table.index('source_type');
    table.index(['user_id', 'source_type']);
  });
}

export async function down(knex: Knex): Promise<void> {
  // Drop pattern_imports table
  await knex.schema.dropTable('pattern_imports');

  // Remove indexes from patterns table
  await knex.schema.alterTable('patterns', (table) => {
    table.dropIndex(['user_id', 'source_type']);
    table.dropIndex('source_type');
  });

  // Remove columns from patterns table
  await knex.schema.alterTable('patterns', (table) => {
    table.dropColumn('original_content');
    table.dropColumn('imported_at');
    table.dropColumn('source_type');
  });
}
