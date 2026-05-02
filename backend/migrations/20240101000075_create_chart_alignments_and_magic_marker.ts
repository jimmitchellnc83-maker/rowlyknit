import { Knex } from 'knex';

/**
 * Migration 075: Wave 5 — chart grid alignment + Magic Marker.
 *
 * Bridges Wave 2's pattern_crops and the existing chart symbol pipeline.
 *
 *   chart_alignments         — one row per (pattern_crop_id) when the
 *                              user has aligned a grid: top-left
 *                              corner + cell counts in normalized
 *                              0..1 coords inside the crop.
 *
 *   magic_marker_samples     — pixel patches the user has tagged with
 *                              a chart symbol. Stores a perceptual
 *                              dHash so similarity search is fast.
 *
 * Naming note: existing `magic_markers` table is the unrelated row-
 * alert feature in Rowly. This Wave 5 surface uses singular
 * `magic_marker_samples` to avoid the collision.
 *
 * Cross-craft: cell math is dimension-agnostic (cells_across,
 * cells_down, no aspect ratio assumption). Filet crochet charts
 * (square cells) and knit charts (often rectangular) flow through
 * the same path; the per-cell width/height is derivable from the
 * grid bbox + cell counts.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('chart_alignments', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('pattern_crop_id')
      .notNullable()
      .unique()
      .references('id')
      .inTable('pattern_crops')
      .onDelete('CASCADE');
    t.uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    // Top-left of the chart grid in normalized 0..1 coords inside the
    // parent crop. Width + height are also normalized; CHECK enforces
    // the rectangle stays inside the unit square.
    t.specificType('grid_x', 'double precision').notNullable();
    t.specificType('grid_y', 'double precision').notNullable();
    t.specificType('grid_width', 'double precision').notNullable();
    t.specificType('grid_height', 'double precision').notNullable();

    t.integer('cells_across').notNullable();
    t.integer('cells_down').notNullable();

    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.index('user_id');
  });

  await knex.raw(`
    ALTER TABLE chart_alignments
      ADD CONSTRAINT chart_alignments_grid_x_check CHECK (grid_x >= 0 AND grid_x <= 1),
      ADD CONSTRAINT chart_alignments_grid_y_check CHECK (grid_y >= 0 AND grid_y <= 1),
      ADD CONSTRAINT chart_alignments_grid_w_check CHECK (grid_width > 0 AND grid_width <= 1),
      ADD CONSTRAINT chart_alignments_grid_h_check CHECK (grid_height > 0 AND grid_height <= 1),
      ADD CONSTRAINT chart_alignments_within_unit_check
        CHECK (grid_x + grid_width <= 1 AND grid_y + grid_height <= 1),
      ADD CONSTRAINT chart_alignments_cells_check
        CHECK (cells_across > 0 AND cells_down > 0)
  `);

  await knex.schema.createTable('magic_marker_samples', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('chart_alignment_id')
      .notNullable()
      .references('id')
      .inTable('chart_alignments')
      .onDelete('CASCADE');
    t.uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    // The chart symbol this sample is tagged with — keys into
    // chart_symbol_templates.symbol. Free-form so a user-defined
    // symbol still works.
    t.string('symbol', 32).notNullable();

    t.integer('grid_row').notNullable();
    t.integer('grid_col').notNullable();

    // 64-bit dHash as a hex string. 16 hex chars = 8 bytes = 64 bits.
    // Bit-distance (Hamming) between two dHashes is the similarity
    // metric magicMarkerService uses.
    t.string('image_hash', 64);

    // Per-sample tuning + history. Permissive JSONB so future tweaks
    // (sample tolerance, ML hooks, anti-features) don't need a new
    // migration.
    t.jsonb('match_metadata');

    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.index('chart_alignment_id');
    t.index(['chart_alignment_id', 'symbol']);
  });

  await knex.raw(`
    ALTER TABLE magic_marker_samples
      ADD CONSTRAINT magic_marker_samples_grid_check
        CHECK (grid_row >= 0 AND grid_col >= 0)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('magic_marker_samples');
  await knex.schema.dropTableIfExists('chart_alignments');
}
