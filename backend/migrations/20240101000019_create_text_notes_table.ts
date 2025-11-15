import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('text_notes', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
    table.uuid('pattern_id').nullable().references('id').inTable('patterns').onDelete('SET NULL');
    table.string('title', 255).nullable();
    table.text('content').notNullable();
    table.jsonb('tags').nullable(); // Array of tags for organization
    table.boolean('is_pinned').defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    // Indexes
    table.index('project_id');
    table.index('pattern_id');
    table.index(['project_id', 'created_at']);
    table.index(['project_id', 'is_pinned']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('text_notes');
}
