import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('handwritten_notes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('pattern_id').nullable().references('id').inTable('patterns').onDelete('SET NULL');
    table.string('image_url', 500).notNullable();
    table.string('original_filename', 255).nullable();
    table.integer('file_size').nullable();
    table.integer('page_number').nullable();
    table.text('notes').nullable();
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_handwritten_notes_project
    ON handwritten_notes (project_id);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('handwritten_notes');
}
