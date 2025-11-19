import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('patterns', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('name', 255).notNullable();
    table.text('description');
    table.string('designer', 255);
    table.string('source', 255); // website, book, magazine, etc.
    table.string('source_url', 500);
    table.string('difficulty', 50); // beginner, easy, intermediate, advanced, expert
    table.string('category', 100); // sweater, scarf, hat, blanket, etc.
    table.jsonb('yarn_requirements').defaultTo('[]'); // weight, yardage, fiber
    table.jsonb('needle_sizes').defaultTo('[]');
    table.jsonb('gauge'); // stitches per inch, rows per inch
    table.jsonb('sizes_available').defaultTo('[]');
    table.integer('estimated_yardage');
    table.string('pdf_url', 500);
    table.string('pdf_filename', 255);
    table.integer('pdf_size');
    table.text('thumbnail_url');
    table.jsonb('tags').defaultTo('[]');
    table.text('notes');
    table.boolean('is_favorite').defaultTo(false);
    table.integer('times_used').defaultTo(0);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at');

    // Indexes
    table.index('user_id');
    table.index('difficulty');
    table.index('category');
    table.index(['user_id', 'is_favorite']);
    table.index('created_at');
  });

  // Junction table for linking patterns to projects
  await knex.schema.createTable('project_patterns', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('pattern_id').notNullable().references('id').inTable('patterns').onDelete('CASCADE');
    table.text('modifications');
    table.timestamp('created_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('project_id');
    table.index('pattern_id');
    table.unique(['project_id', 'pattern_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('project_patterns');
  return knex.schema.dropTable('patterns');
}
