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

  // Idempotent index creation — migration #034 also creates this index, so on
  // a fresh DB the previous `alterTable.index().catch(()=>{})` form raised
  // "relation already exists", swallowed the JS error, and left the enclosing
  // migration transaction aborted, which cascaded into "current transaction is
  // aborted, commands ignored until end of transaction block" on the next
  // hasColumn query and broke disaster-recovery rebuilds. Using raw IF NOT
  // EXISTS keeps the transaction healthy regardless of prior state.
  await knex.raw(
    'CREATE INDEX IF NOT EXISTS idx_handwritten_notes_project ON handwritten_notes (project_id)'
  );

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
