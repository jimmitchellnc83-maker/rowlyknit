import { Knex } from 'knex';

/**
 * Migration 073: Wave 3 — annotations + QuickKey on pattern_crops.
 *
 * Annotations are pen / highlight / text / stamp overlays that live
 * inside an existing crop. They reuse Wave 2's normalized crop coords
 * (every stroke point is 0..1 inside the *crop's* rectangle, not the
 * page), so re-rasterizing at any zoom level keeps them aligned.
 *
 * QuickKey is a bookmarking surface — knitters mark a crop they want
 * to scroll back to, give it a position in the sidebar, and the tile
 * list shows them ordered. Lives as two columns on pattern_crops, not
 * a separate table — the relationship is 1:1 and we already query
 * crops by source file.
 */

const ANNOTATION_TYPES = ['pen', 'highlight', 'text', 'stamp'];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('pattern_crop_annotations', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('pattern_crop_id')
      .notNullable()
      .references('id')
      .inTable('pattern_crops')
      .onDelete('CASCADE');
    t.uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    // pen | highlight | text | stamp — craft-neutral and stable.
    t.string('annotation_type', 32).notNullable();

    // Free-form payload. Pen / highlight: { strokes: [[{x,y},...]], color, width }.
    // Text: { x, y, text, fontSize, color }. Stamp: { x, y, symbol }.
    // All coords are normalized 0..1 inside the parent crop.
    t.jsonb('payload').notNullable();

    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('deleted_at');

    t.index('pattern_crop_id');
    t.index('user_id');
  });

  await knex.raw(`
    ALTER TABLE pattern_crop_annotations
      ADD CONSTRAINT pattern_crop_annotations_type_check
        CHECK (annotation_type IN (${ANNOTATION_TYPES.map((s) => `'${s}'`).join(', ')}))
  `);

  // QuickKey columns on pattern_crops. is_quickkey false by default;
  // quickkey_position is null until the user pins a crop and sets the
  // sidebar order. NULL means "not in the sidebar."
  await knex.schema.alterTable('pattern_crops', (t) => {
    t.boolean('is_quickkey').notNullable().defaultTo(false);
    t.integer('quickkey_position');
  });

  // Quick lookup for "all the QuickKey crops on this pattern, in order"
  await knex.raw(`
    CREATE INDEX idx_pattern_crops_quickkey
      ON pattern_crops (pattern_id, quickkey_position)
      WHERE is_quickkey = true AND deleted_at IS NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS idx_pattern_crops_quickkey');
  await knex.schema.alterTable('pattern_crops', (t) => {
    t.dropColumn('is_quickkey');
    t.dropColumn('quickkey_position');
  });
  await knex.schema.dropTableIfExists('pattern_crop_annotations');
}
