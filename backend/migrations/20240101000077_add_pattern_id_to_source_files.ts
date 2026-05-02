import { Knex } from 'knex';

/**
 * Migration 077: tighten Source File scoping.
 *
 * The Wave 2 schema kept source_files at the user level — pattern
 * association lived purely on `pattern_crops.pattern_id`. That works
 * for files the user has already drawn crops on, but a freshly
 * uploaded file (where the user picked a pattern context but hasn't
 * drawn anything yet) had no link back to the pattern.
 *
 * Result post-PR #346: the Sources tab on PatternDetail showed only
 * files with ≥1 crop on this pattern, which silently hid newly
 * uploaded files. This migration adds an `intended_pattern_id` column
 * that the upload controller can set from the patternId form param.
 *
 * Nullable + ON DELETE SET NULL so existing rows are valid post-run
 * and the column doesn't load-bear on referential integrity.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('source_files', (t) => {
    t.uuid('intended_pattern_id')
      .nullable()
      .references('id')
      .inTable('patterns')
      .onDelete('SET NULL');
    t.index(['user_id', 'intended_pattern_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('source_files', (t) => {
    t.dropIndex(['user_id', 'intended_pattern_id']);
    t.dropColumn('intended_pattern_id');
  });
}
