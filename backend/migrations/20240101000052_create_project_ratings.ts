import type { Knex } from 'knex';

/**
 * Personal 1–5 project ratings with optional notes + public toggle.
 *
 * The public toggle is the feature's teeth: on a pattern page we count how
 * many *other* knitters have made it by joining public ratings up to the
 * project's patterns and matching on `patterns.ravelry_id`. Private
 * ratings stay between the user and their project.
 *
 * UNIQUE (user_id, project_id) — a user has at most one rating per project.
 * Upsert-style API on the controller writes to this table.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('project_ratings', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .uuid('project_id')
      .notNullable()
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');
    table.integer('rating').notNullable();
    table.text('notes');
    table.boolean('is_public').notNullable().defaultTo(false);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());

    table.unique(['user_id', 'project_id']);
    table.index('project_id');
    table.index('is_public');
  });

  await knex.raw(
    'ALTER TABLE project_ratings ADD CONSTRAINT project_ratings_rating_range CHECK (rating BETWEEN 1 AND 5)',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTable('project_ratings');
}
