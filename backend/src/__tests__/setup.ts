/**
 * Test setup for backend tests.
 *
 * `setupFilesAfterEnv` in jest.config.ts loads this file for every suite, so
 * any top-level side effect here runs for unit tests too. Migrations are
 * therefore opt-in: integration tests call `ensureMigrated()` in their own
 * beforeAll, while pure unit tests (which mock their dependencies) skip it
 * entirely and run without Postgres.
 *
 * PREREQUISITES for integration tests:
 *   - A running PostgreSQL instance reachable via DB_TEST_* env vars
 *     (defaults: localhost:5432, database rowly_test, user postgres).
 */

import knex from 'knex';
import config from '../../knexfile';

const testDb = knex(config.test);

/**
 * Apply all pending migrations against the test database. Integration tests
 * should await this in their own beforeAll. Safe to call multiple times —
 * `knex.migrate.latest` is idempotent.
 */
export async function ensureMigrated(): Promise<void> {
  await testDb.migrate.latest();
}

afterAll(async () => {
  await testDb.destroy();
});

export default testDb;
