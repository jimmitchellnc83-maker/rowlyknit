import { Knex } from 'knex';

/**
 * Migration 076: Wave 6 — join layouts + blank work pages.
 *
 * join_layouts assemble multiple Wave-2 crops into one canvas. Each
 * layout has a list of regions (pattern_crop_id + canvas-normalized
 * placement), so a knitter can put page-5-of-PDF-A next to page-12-of-
 * PDF-B and a hand-sketched blank page on one screen.
 *
 * blank_pages are first-class drawing surfaces — no underlying PDF —
 * with the same Wave 3 stroke shape. Cross-craft from the start.
 */

const ASPECT_KINDS = ['letter', 'a4', 'square', 'custom'];
const CRAFTS = ['knit', 'crochet'];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('join_layouts', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id')
      .notNullable()
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');
    t.uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    t.string('name', 120).notNullable();
    // [{ patternCropId, x, y, w, h, zIndex }] — placement coords are
    // canvas-normalized 0..1 (matching Wave 2's contract).
    t.jsonb('regions').notNullable().defaultTo('[]');
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('deleted_at');

    t.index('project_id');
    t.index('user_id');
  });

  await knex.schema.createTable('blank_pages', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id')
      .notNullable()
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');
    t.uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    t.string('name', 120);

    // Cross-craft column. Defaults to 'knit' to match current
    // population; crochet flows pass 'crochet' explicitly.
    t.string('craft', 20).notNullable().defaultTo('knit');

    t.specificType('width', 'double precision').notNullable();
    t.specificType('height', 'double precision').notNullable();
    t.string('aspect_kind', 24).notNullable().defaultTo('letter');

    // Same shape as Wave 3 annotations — array of stroke objects.
    t.jsonb('strokes').notNullable().defaultTo('[]');

    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('deleted_at');

    t.index('project_id');
  });

  await knex.raw(`
    ALTER TABLE blank_pages
      ADD CONSTRAINT blank_pages_aspect_kind_check
        CHECK (aspect_kind IN (${ASPECT_KINDS.map((s) => `'${s}'`).join(', ')})),
      ADD CONSTRAINT blank_pages_craft_check
        CHECK (craft IN (${CRAFTS.map((c) => `'${c}'`).join(', ')})),
      ADD CONSTRAINT blank_pages_dimensions_check
        CHECK (width > 0 AND height > 0)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('blank_pages');
  await knex.schema.dropTableIfExists('join_layouts');
}
