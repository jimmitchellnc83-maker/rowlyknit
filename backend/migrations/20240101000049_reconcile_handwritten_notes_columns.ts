import { Knex } from 'knex';

/**
 * The prod handwritten_notes table was created with an earlier revision
 * of migration 34 that only defined {id, project_id, image_url, title,
 * created_at, updated_at}. The current controller expects pattern_id,
 * original_filename, file_size, page_number, notes — causing every save
 * to 500 with "column does not exist".
 *
 * This migration adds the missing columns without touching the legacy
 * title / updated_at columns (harmless to keep).
 */
export async function up(knex: Knex): Promise<void> {
  const hasCol = async (col: string) =>
    knex.schema.hasColumn('handwritten_notes', col);

  await knex.schema.alterTable('handwritten_notes', (table) => {
    table.index(['project_id'], 'idx_handwritten_notes_project');
  }).catch(() => { /* index may already exist */ });

  const adds: Array<(t: Knex.AlterTableBuilder) => void> = [];

  if (!(await hasCol('pattern_id'))) {
    adds.push((t) =>
      t.uuid('pattern_id').nullable().references('id').inTable('patterns').onDelete('SET NULL')
    );
  }
  if (!(await hasCol('original_filename'))) {
    adds.push((t) => t.string('original_filename', 255).nullable());
  }
  if (!(await hasCol('file_size'))) {
    adds.push((t) => t.integer('file_size').nullable());
  }
  if (!(await hasCol('page_number'))) {
    adds.push((t) => t.integer('page_number').nullable());
  }
  if (!(await hasCol('notes'))) {
    adds.push((t) => t.text('notes').nullable());
  }

  if (adds.length > 0) {
    await knex.schema.alterTable('handwritten_notes', (table) => {
      adds.forEach((fn) => fn(table));
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('handwritten_notes', (table) => {
    table.dropColumn('pattern_id');
    table.dropColumn('original_filename');
    table.dropColumn('file_size');
    table.dropColumn('page_number');
    table.dropColumn('notes');
  });
}
