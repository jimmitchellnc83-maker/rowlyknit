import type { Knex } from 'knex';

/**
 * Ravelry Tier 1 schema additions:
 *   - `ravelry_id` on `patterns` and `projects` (indexed + unique per-user for idempotent imports)
 *   - `ravelry_bookmarks` — unified queue + library mirror with a `type` discriminator
 *
 * Idempotent: skips any column / index / constraint / table that already exists.
 * Production has an orphan `patterns.ravelry_id` column added by an uncommitted
 * 20240101000039 migration run manually at some point; this migration silently
 * adopts it instead of failing.
 *
 * Yarn already has `ravelry_id` (000036) and `is_favorite` (000006); no yarn changes.
 */

async function hasIndex(knex: Knex, table: string, indexName: string): Promise<boolean> {
  const result = await knex.raw(
    `SELECT 1 FROM pg_indexes WHERE tablename = ? AND indexname = ?`,
    [table, indexName]
  );
  return result.rows.length > 0;
}

async function hasConstraint(knex: Knex, constraintName: string): Promise<boolean> {
  const result = await knex.raw(
    `SELECT 1 FROM pg_constraint WHERE conname = ?`,
    [constraintName]
  );
  return result.rows.length > 0;
}

async function ensureRavelryId(knex: Knex, table: string): Promise<void> {
  if (!(await knex.schema.hasColumn(table, 'ravelry_id'))) {
    await knex.schema.alterTable(table, (t) => {
      t.integer('ravelry_id').nullable();
    });
  }
  if (!(await hasIndex(knex, table, `${table}_ravelry_id_index`))) {
    await knex.schema.alterTable(table, (t) => {
      t.index('ravelry_id');
    });
  }
  if (!(await hasConstraint(knex, `${table}_user_id_ravelry_id_unique`))) {
    await knex.schema.alterTable(table, (t) => {
      t.unique(['user_id', 'ravelry_id']);
    });
  }
}

export async function up(knex: Knex): Promise<void> {
  await ensureRavelryId(knex, 'patterns');
  await ensureRavelryId(knex, 'projects');

  if (!(await knex.schema.hasTable('ravelry_bookmarks'))) {
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
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('ravelry_bookmarks');

  for (const table of ['projects', 'patterns']) {
    if (await hasConstraint(knex, `${table}_user_id_ravelry_id_unique`)) {
      await knex.schema.alterTable(table, (t) => {
        t.dropUnique(['user_id', 'ravelry_id']);
      });
    }
    if (await hasIndex(knex, table, `${table}_ravelry_id_index`)) {
      await knex.schema.alterTable(table, (t) => {
        t.dropIndex('ravelry_id');
      });
    }
    if (await knex.schema.hasColumn(table, 'ravelry_id')) {
      await knex.schema.alterTable(table, (t) => {
        t.dropColumn('ravelry_id');
      });
    }
  }
}
