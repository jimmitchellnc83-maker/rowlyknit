import type { Knex } from 'knex';

/**
 * Ravelry Tier 1 schema additions:
 *   - `ravelry_id` on `patterns` and `projects` (idempotent import dedup)
 *   - `ravelry_bookmarks` — unified queue + library mirror with a `type` discriminator
 *
 * Yarn already has `ravelry_id` (migration 000036) and `is_favorite` (migration 000006),
 * so nothing needs to change there.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('patterns', (table) => {
    table.integer('ravelry_id').nullable();
    table.index('ravelry_id');
    table.unique(['user_id', 'ravelry_id']);
  });

  await knex.schema.alterTable('projects', (table) => {
    table.integer('ravelry_id').nullable();
    table.index('ravelry_id');
    table.unique(['user_id', 'ravelry_id']);
  });

  await knex.schema.createTable('ravelry_bookmarks', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
    // 'queue' = Ravelry queue entry (to-knit list)
    // 'library' = Ravelry library item (purchased patterns, books)
    table.string('type', 20).notNullable();
    table.integer('ravelry_id').notNullable();
    table.integer('pattern_ravelry_id').nullable();
    table.string('title', 500).notNullable();
    table.string('author', 255).nullable();
    table.text('photo_url').nullable();
    table.string('source_type', 50).nullable(); // 'pattern' | 'book' (library only)
    table.integer('position').nullable(); // queue sort order
    table.text('notes').nullable();
    table.jsonb('data').defaultTo('{}'); // raw Ravelry payload for fields we don't surface yet
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('deleted_at');

    table.index('user_id');
    table.index(['user_id', 'type']);
    table.unique(['user_id', 'type', 'ravelry_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ravelry_bookmarks');

  await knex.schema.alterTable('projects', (table) => {
    table.dropUnique(['user_id', 'ravelry_id']);
    table.dropIndex('ravelry_id');
    table.dropColumn('ravelry_id');
  });

  await knex.schema.alterTable('patterns', (table) => {
    table.dropUnique(['user_id', 'ravelry_id']);
    table.dropIndex('ravelry_id');
    table.dropColumn('ravelry_id');
  });
}
