import type { Knex } from 'knex';

/**
 * Canonical Pattern entity — PR 1 of the Designer rebuild.
 *
 * Today the Designer is form-first: a `DesignerFormSnapshot` JSONB blob
 * sits inside `patterns.metadata.designer` (or `projects.metadata.designer`)
 * and 8 hardcoded itemType compute functions render schematics and step
 * lists from it. The PRD (`docs/PATTERN_DESIGNER_PRD.md`) requires a
 * structured, schema-first model that ties chart + text + gauge + sizes +
 * sections + progress together so future surfaces can read one truth.
 *
 * This table is that canonical model. It lives ALONGSIDE the form-snapshot
 * path — no UI cuts over in this PR. The accompanying service-layer
 * importer reads existing snapshots and writes shadow rows here, so every
 * legacy draft has a canonical Pattern twin while both schemas coexist.
 *
 * Notes:
 *  - `source_pattern_id` / `source_project_id` link a canonical row back to
 *    the legacy row it was imported from. Either, both, or neither may be
 *    set: a net-new design (future) has neither; a draft saved to a project
 *    has source_project_id; a draft saved as a library pattern has
 *    source_pattern_id; a draft saved to both has both.
 *  - The partial unique indexes on each source make the importer
 *    idempotent: re-running it for the same source row is a conflict the
 *    service handles as an update, not a duplicate insert.
 *  - `schema_version` is reserved for future shape migrations within JSONB.
 *    Starts at 1 today; bump only when consumer code needs to discriminate
 *    old vs. new shapes.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('pattern_models', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table
      .uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .uuid('source_pattern_id')
      .nullable()
      .references('id')
      .inTable('patterns')
      .onDelete('SET NULL');
    table
      .uuid('source_project_id')
      .nullable()
      .references('id')
      .inTable('projects')
      .onDelete('SET NULL');

    table.string('name', 255).notNullable();
    table.string('craft', 32).notNullable();
    table.string('technique', 32).notNullable().defaultTo('standard');

    table.jsonb('gauge_profile').notNullable().defaultTo('{}');
    table.jsonb('size_set').notNullable().defaultTo('{}');
    table.jsonb('sections').notNullable().defaultTo('[]');
    table.jsonb('legend').notNullable().defaultTo('{}');
    table.jsonb('materials').notNullable().defaultTo('[]');
    table.jsonb('progress_state').notNullable().defaultTo('{}');
    table.text('notes').nullable();

    table.integer('schema_version').notNullable().defaultTo(1);

    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('deleted_at').nullable();

    table.index(['user_id']);
    table.index(['user_id', 'deleted_at']);

    table.check(`craft IN ('knit', 'crochet')`);
    table.check(
      `technique IN ('standard','lace','cables','colorwork','tapestry','filet','tunisian')`,
    );
  });

  // Partial unique indexes — one canonical Pattern per legacy source row,
  // but only when the source link is set. Knex's `.unique()` builder does
  // not support partial predicates, so use raw DDL.
  await knex.schema.raw(
    `CREATE UNIQUE INDEX pattern_models_source_pattern_id_unique
       ON pattern_models (source_pattern_id)
       WHERE source_pattern_id IS NOT NULL`,
  );
  await knex.schema.raw(
    `CREATE UNIQUE INDEX pattern_models_source_project_id_unique
       ON pattern_models (source_project_id)
       WHERE source_project_id IS NOT NULL`,
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('pattern_models');
}
