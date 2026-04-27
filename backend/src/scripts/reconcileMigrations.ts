/**
 * Pre-migrate reconciliation script.
 *
 * Why this exists: at some point, migration files 39-46 ran against prod and
 * were later deleted/renamed in git, leaving orphan rows in prod's
 * knex_migrations table. Knex ignores orphan rows on migrate:latest, so
 * nothing CURRENTLY breaks, but:
 *
 *   - A future migration that re-adds a file with the same orphan name
 *     would be silently skipped (knex would treat it as already applied).
 *   - The drift makes "what's the real prod schema?" harder to answer.
 *   - Any script that diffs repo vs prod migrations reports 8 false positives.
 *
 * This script is run automatically before `npm run migrate` by the production
 * deploy. It:
 *
 *   1. Lists every file in the migrations directory that knex would look at.
 *   2. Queries knex_migrations for every recorded `name`.
 *   3. Treats a row as orphaned if its name has no corresponding file.
 *   4. Logs the full list of orphans at error level (so it surfaces in Sentry).
 *   5. Deletes the orphan rows. Non-fatal if the table doesn't exist yet
 *      (fresh install). Transaction-wrapped so a concurrent deploy can't
 *      race it.
 *
 * Dev has no drift (provisioned from the same repo), so this is a no-op
 * outside prod.
 *
 * Usage (from a compiled environment):
 *   node dist/src/scripts/reconcileMigrations.js
 */

import fs from 'fs';
import path from 'path';
import knex from 'knex';
import knexConfig from '../../knexfile';

async function run(): Promise<void> {
  const environment = process.env.NODE_ENV || 'development';
  const config = knexConfig[environment];
  if (!config) {
    // eslint-disable-next-line no-console
    console.error(`[reconcileMigrations] No knexfile config for NODE_ENV=${environment}`);
    process.exit(1);
  }

  const db = knex(config);

  try {
    // Resolve the migrations directory the same way knex will.
    const migrationsDir = (config.migrations && typeof config.migrations === 'object'
      && 'directory' in config.migrations && typeof config.migrations.directory === 'string')
      ? config.migrations.directory
      : path.join(__dirname, '../../migrations');

    // Knex's `knex_migrations` table stores the filename (with extension) in `name`.
    // Build the set of known filenames from disk.
    let filesOnDisk: Set<string>;
    try {
      const entries = fs.readdirSync(migrationsDir);
      filesOnDisk = new Set(entries.filter((e) => e.endsWith('.ts') || e.endsWith('.js')));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[reconcileMigrations] Could not read migrations dir ${migrationsDir}`, err);
      await db.destroy();
      process.exit(1);
    }

    const hasMigrationsTable = await db.schema.hasTable('knex_migrations');
    if (!hasMigrationsTable) {
      // eslint-disable-next-line no-console
      console.log('[reconcileMigrations] knex_migrations table does not exist yet — nothing to do.');
      await db.destroy();
      return;
    }

    const rows = await db('knex_migrations').select('id', 'name');
    const orphans = rows.filter((row) => {
      const name: string = row.name;
      // A name matches if the exact file is present, or the .js-compiled
      // equivalent is (knex records the filename that was actually run).
      return !filesOnDisk.has(name) && !filesOnDisk.has(name.replace(/\.ts$/, '.js')) && !filesOnDisk.has(name.replace(/\.js$/, '.ts'));
    });

    if (orphans.length === 0) {
      // eslint-disable-next-line no-console
      console.log(`[reconcileMigrations] OK — ${rows.length} recorded migrations, no orphans.`);
      await db.destroy();
      return;
    }

    // eslint-disable-next-line no-console
    console.error(`[reconcileMigrations] Found ${orphans.length} orphan row(s) in knex_migrations:`);
    for (const o of orphans) {
      // eslint-disable-next-line no-console
      console.error(`  id=${o.id}  name=${o.name}`);
    }

    await db.transaction(async (trx) => {
      for (const o of orphans) {
        await trx('knex_migrations').where({ id: o.id }).delete();
      }
    });

    // eslint-disable-next-line no-console
    console.error(`[reconcileMigrations] Deleted ${orphans.length} orphan row(s). The schema changes they recorded are NOT rolled back; only the tracking entries are removed.`);
  } finally {
    await db.destroy();
  }
}

run().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[reconcileMigrations] fatal', err);
  process.exit(1);
});
