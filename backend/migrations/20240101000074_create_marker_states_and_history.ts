import { Knex } from 'knex';

/**
 * Migration 074: Wave 4 — canonical MarkerState + history.
 *
 * Today, "where you are in the pattern" lives in three disconnected
 * stores: counters (counter values), panel_groups + panels (Panel
 * Mode positions), and pattern_models.progress_state (chart cell
 * progress). Tabbing between them shows three independent positions.
 *
 * Wave 4 adds an *adapter* — not a UI replacement — so each surface
 * mirrors its position into a single source of truth and a history
 * ring buffer. UI keeps its existing shape; reads + writes get a
 * sibling call into markerStateService that records the move.
 *
 *   marker_states          — current position per (project, surface, surface_ref)
 *   marker_state_history   — append-only log of changes, capped per-project
 *
 * Cross-craft: `surface` and `position` are intentionally permissive
 * JSONB — knit projects use `{ row, currentCount }`, crochet rounds
 * use the same shape, panel mode adds `panelIndex`, etc. Adding new
 * surface kinds means adding a string to the enum, not a new table.
 */

const SURFACES = ['counter', 'panel', 'chart'];

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('marker_states', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('project_id')
      .notNullable()
      .references('id')
      .inTable('projects')
      .onDelete('CASCADE');
    // pattern_id is nullable — project-level state (e.g. global row
    // counters that don't belong to a specific pattern) lives here too.
    t.uuid('pattern_id')
      .nullable()
      .references('id')
      .inTable('patterns')
      .onDelete('CASCADE');
    t.string('surface', 32).notNullable();
    // surface_ref is the underlying row id — counter id, panel id,
    // chart id. Stored as a string so the FK doesn't dangle when a
    // counter is hard-deleted (we soft-delete in practice, but the
    // contract is "best-effort historical record"). Not a hard FK.
    t.string('surface_ref', 64).nullable();
    t.jsonb('position').notNullable();
    t.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    t.unique(['project_id', 'pattern_id', 'surface', 'surface_ref'], {
      indexName: 'marker_states_unique_key',
    });
    t.index('project_id');
  });

  await knex.raw(`
    ALTER TABLE marker_states
      ADD CONSTRAINT marker_states_surface_check
        CHECK (surface IN (${SURFACES.map((s) => `'${s}'`).join(', ')}))
  `);

  await knex.schema.createTable('marker_state_history', (t) => {
    t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('marker_state_id')
      .notNullable()
      .references('id')
      .inTable('marker_states')
      .onDelete('CASCADE');
    // Denormalize project_id so we can prune by project without a join.
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
    t.jsonb('previous_position').nullable();
    t.jsonb('new_position').notNullable();
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    t.index('marker_state_id');
    t.index(['project_id', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('marker_state_history');
  await knex.schema.dropTableIfExists('marker_states');
}
