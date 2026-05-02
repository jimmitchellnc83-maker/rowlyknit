import { Knex } from 'knex';

/**
 * Migration 072: Wave 2 PDF-first execution model — schema layer.
 *
 * The existing `pattern_files` table is fine for raw blob storage but
 * doesn't carry the load-bearing concepts the rest of Wave 2/3/4/5/6 sit
 * on:
 *
 *   - Page count and per-page dimensions (so the UI can render thumbs
 *     without re-parsing the PDF on every request).
 *   - A parse-status state machine so we know whether OCR + symbol
 *     detection has run yet.
 *   - Cross-craft from the start: a knit/crochet column on the file
 *     itself, so when a knitter and a crocheter both upload PDFs, the
 *     rest of the stack can branch on craft without inferring it from
 *     the file's contents.
 *
 * Two new tables:
 *
 *   `source_files` — one row per uploaded artifact (PDF, chart image,
 *     reference doc). Holds page metadata + parse state. Storage layer
 *     reuses the random-hex contract from migration #070.
 *
 *   `pattern_crops` — one row per (page, normalized rectangle) — the
 *     coord system Wave 3 (annotation/QuickKey), Wave 4 (MarkerState),
 *     and Wave 5 (chart grid alignment) all reference. Coords are
 *     normalized 0..1 so the same crop survives a re-rasterization at
 *     a different zoom level.
 *
 *   `project_patterns.source_file_id` — nullable FK so a project's
 *     instance of a pattern can point at a specific uploaded artifact.
 *     A pattern can have many source files (different printings,
 *     errata revisions); the project pins one. NULL = "use the
 *     pattern's primary file" / no PDF chosen yet.
 */

const SOURCE_FILE_KINDS = ['pattern_pdf', 'chart_image', 'reference_doc'];
const PARSE_STATUSES = ['pending', 'parsed', 'failed', 'skipped'];
const CRAFTS = ['knit', 'crochet'];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('source_files', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    // Cross-craft: which craft does this file describe? Defaults to
    // 'knit' to match the current population, but the column is
    // first-class so a future crochet uploader doesn't have to back-
    // fill anything. Keep the enum tight — adding tunisian/loom-knit
    // later means a CHECK relax + data backfill, no schema redesign.
    t.string('craft', 20).notNullable().defaultTo('knit');

    // What kind of file. Drives downstream behavior: pattern_pdf gets
    // page-by-page parse + crop UI; chart_image goes straight into
    // chart-detection; reference_doc is a glorified attachment.
    t.string('kind', 32).notNullable().defaultTo('pattern_pdf');

    // Storage layer mirrors Wave 1 #1: random-hex filename inside a
    // sanctioned subdir. The auth-streaming endpoint resolves
    // `sourceFile.id` → `<root>/<storage_subdir>/<storage_filename>`.
    t.string('storage_filename', 64).notNullable();
    t.string('storage_subdir', 64).notNullable().defaultTo('patterns');
    t.string('original_filename', 255);
    t.string('mime_type', 100);
    t.integer('size_bytes');

    // PDF-specific metadata. Populated lazily by the parser pass —
    // null until parse_status flips off 'pending'.
    t.integer('page_count');
    t.jsonb('page_dimensions'); // [{ w, h, unit }, ...] per page

    // Parser state machine. Stays 'pending' until a worker (TBD; in a
    // later PR) walks the file. Failures stash the message in
    // parse_error; parsed-with-no-charts uses 'skipped'.
    t.string('parse_status', 20).notNullable().defaultTo('pending');
    t.text('parse_error');

    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('deleted_at');

    t.index('user_id');
    t.index(['user_id', 'craft']);
  });

  // CHECKs in raw SQL because knex's `.checkIn(...)` wrapper drops the
  // constraint name we want for diagnostics.
  await knex.raw(`
    ALTER TABLE source_files
      ADD CONSTRAINT source_files_kind_check
        CHECK (kind IN (${SOURCE_FILE_KINDS.map((k) => `'${k}'`).join(', ')})),
      ADD CONSTRAINT source_files_parse_status_check
        CHECK (parse_status IN (${PARSE_STATUSES.map((s) => `'${s}'`).join(', ')})),
      ADD CONSTRAINT source_files_craft_check
        CHECK (craft IN (${CRAFTS.map((c) => `'${c}'`).join(', ')}))
  `);

  await knex.schema.createTable('pattern_crops', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('source_file_id')
      .notNullable()
      .references('id')
      .inTable('source_files')
      .onDelete('CASCADE');
    t.uuid('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    // Optional pattern linkage. A crop can hang off a pattern (and
    // optionally a section within it); a Wave 3 QuickKey crop has
    // pattern_id NULL.
    t.uuid('pattern_id').references('id').inTable('patterns').onDelete('SET NULL');
    t.string('pattern_section_id', 64);

    // 1-indexed (matches PDF.js convention).
    t.integer('page_number').notNullable();

    // Normalized coords, top-left origin. Constraint below enforces
    // the rectangle stays inside the unit square.
    t.specificType('crop_x', 'double precision').notNullable();
    t.specificType('crop_y', 'double precision').notNullable();
    t.specificType('crop_width', 'double precision').notNullable();
    t.specificType('crop_height', 'double precision').notNullable();

    // Wave 3 QuickKey: human-readable label for jump-back navigation.
    t.string('label', 120);

    // Wave 4 / Wave 5: when this crop encloses a chart, point at the
    // canonical chart row. Not a hard FK because charts can be created
    // lazily after the crop exists.
    t.uuid('chart_id');

    // Free-form per-crop metadata (Wave 3 annotations, MagicMarker
    // sample refs, etc.).
    t.jsonb('metadata').notNullable().defaultTo('{}');

    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    t.timestamp('deleted_at');

    t.index('source_file_id');
    t.index('pattern_id');
    t.index(['pattern_id', 'pattern_section_id']);
  });

  await knex.raw(`
    ALTER TABLE pattern_crops
      ADD CONSTRAINT pattern_crops_page_number_check CHECK (page_number >= 1),
      ADD CONSTRAINT pattern_crops_x_range_check CHECK (crop_x >= 0 AND crop_x <= 1),
      ADD CONSTRAINT pattern_crops_y_range_check CHECK (crop_y >= 0 AND crop_y <= 1),
      ADD CONSTRAINT pattern_crops_width_range_check
        CHECK (crop_width > 0 AND crop_width <= 1),
      ADD CONSTRAINT pattern_crops_height_range_check
        CHECK (crop_height > 0 AND crop_height <= 1),
      ADD CONSTRAINT pattern_crops_within_unit_square_check
        CHECK (crop_x + crop_width <= 1 AND crop_y + crop_height <= 1)
  `);

  // project_patterns gains a pointer to the source file the project is
  // currently working from. Nullable so the existing rows are valid
  // post-migration (their projects use `pattern_files` directly via the
  // legacy path); newly-created project_pattern rows can attach a
  // source_file as soon as the upload pipeline lands.
  await knex.schema.alterTable('project_patterns', (t) => {
    t.uuid('source_file_id')
      .nullable()
      .references('id')
      .inTable('source_files')
      .onDelete('SET NULL');
    t.index('source_file_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('project_patterns', (t) => {
    t.dropIndex('source_file_id');
    t.dropColumn('source_file_id');
  });
  await knex.schema.dropTableIfExists('pattern_crops');
  await knex.schema.dropTableIfExists('source_files');
}
