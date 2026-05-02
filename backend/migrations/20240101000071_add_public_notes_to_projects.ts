import { Knex } from 'knex';

/**
 * Migration 071: opt-in public notes on shared projects.
 *
 * Pre-2026-05-02 the public projection (`projectSharingService.getPublicProjectBySlug`)
 * returned `project.notes` and `project.metadata` verbatim. Notes are
 * commonly free-form scratch space (recipient names, gift dates,
 * yardage spreadsheet snippets, "Aunt Mary doesn't like this color"),
 * so emitting them on the public FO page leaks more than knitters
 * realised when they hit the share toggle.
 *
 * After this PR notes are stripped from the public view by default;
 * `public_notes=true` opts back in. The metadata projection moves to
 * an allowlist (gauge / needles / finishedSize) on the service side —
 * no schema change needed for that part.
 *
 * Default `false` so existing publishers stop leaking. The share
 * modal gets a toggle to re-enable per-project (frontend change in
 * the same PR).
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('projects', (t) => {
    t.boolean('public_notes').notNullable().defaultTo(false);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('projects', (t) => {
    t.dropColumn('public_notes');
  });
}
