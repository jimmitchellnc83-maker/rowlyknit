import { Knex } from 'knex';

/**
 * Migration 069: add `care_symbols` JSONB to yarns.
 *
 * The yarn record already carries a `machine_washable` boolean (since
 * migration #036) but knitters need richer care info: bleach
 * tolerance, dry method, iron temperature, dry-clean rules. CYC's
 * five care-symbol families cover the load-bearing cases.
 *
 * Storage shape (validated client + server via
 * `frontend/src/utils/careSymbols.ts` and the parallel `sanitizeCareSymbols`):
 *
 *   [
 *     { category: 'wash',     prohibited: false, modifier: 'machine-30', label: 'Machine wash 30°C' },
 *     { category: 'bleach',   prohibited: true,  modifier: null,         label: 'Do not bleach' },
 *     { category: 'dry',      prohibited: false, modifier: 'flat',       label: 'Dry flat' },
 *     ...
 *   ]
 *
 * Default `[]` so existing rows are well-formed without backfill.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('yarn', (table) => {
    table.jsonb('care_symbols').notNullable().defaultTo('[]');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('yarn', (table) => {
    table.dropColumn('care_symbols');
  });
}
