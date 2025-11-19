import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Pattern sections for PDF organization
  await knex.schema.createTable('pattern_sections', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('pattern_id').notNullable().references('id').inTable('patterns').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.integer('page_number').nullable();
    table.integer('y_position').nullable(); // Position on page
    table.integer('sort_order').defaultTo(0);
    table.uuid('parent_section_id').nullable().references('id').inTable('pattern_sections').onDelete('SET NULL');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('pattern_id');
    table.index(['pattern_id', 'sort_order']);
  });

  // Pattern bookmarks
  await knex.schema.createTable('pattern_bookmarks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('pattern_id').notNullable().references('id').inTable('patterns').onDelete('CASCADE');
    table.uuid('project_id').nullable().references('id').inTable('projects').onDelete('CASCADE');
    table.string('name', 255).notNullable(); // "Current row", "Sleeve decreases"
    table.integer('page_number').notNullable();
    table.integer('y_position').nullable();
    table.decimal('zoom_level', 3, 2).defaultTo(1.0);
    table.text('notes').nullable();
    table.string('color', 7).defaultTo('#FBBF24'); // Hex color
    table.integer('sort_order').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('pattern_id');
    table.index('project_id');
    table.index(['pattern_id', 'project_id']);
  });

  // Pattern highlights
  await knex.schema.createTable('pattern_highlights', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('pattern_id').notNullable().references('id').inTable('patterns').onDelete('CASCADE');
    table.uuid('project_id').nullable().references('id').inTable('projects').onDelete('CASCADE');
    table.integer('page_number').notNullable();
    table.jsonb('coordinates').notNullable(); // { x, y, width, height }
    table.string('color', 7).defaultTo('#FBBF24');
    table.decimal('opacity', 2, 1).defaultTo(0.3);
    table.integer('layer').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('pattern_id');
    table.index('project_id');
    table.index(['pattern_id', 'page_number']);
  });

  // Pattern annotations (handwritten notes, drawings)
  await knex.schema.createTable('pattern_annotations', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('pattern_id').notNullable().references('id').inTable('patterns').onDelete('CASCADE');
    table.uuid('project_id').nullable().references('id').inTable('projects').onDelete('CASCADE');
    table.integer('page_number').notNullable();
    table.string('annotation_type', 50).notNullable(); // 'drawing', 'text', 'arrow'
    table.jsonb('data').nullable(); // Canvas path data or text content
    table.string('image_url', 500).nullable(); // Exported PNG
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('pattern_id');
    table.index('project_id');
    table.index(['pattern_id', 'page_number']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('pattern_annotations');
  await knex.schema.dropTable('pattern_highlights');
  await knex.schema.dropTable('pattern_bookmarks');
  await knex.schema.dropTable('pattern_sections');
}
