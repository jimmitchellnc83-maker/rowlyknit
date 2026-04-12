/**
 * Test setup and teardown for backend integration tests.
 *
 * PREREQUISITES:
 *   - A running PostgreSQL instance accessible via the DB_* env vars
 *     (defaults: localhost:5432, database rowly_dev, user postgres).
 *   - Migrations must be runnable against that database.
 *
 * The setup runs migrations before all tests and tears down the
 * Knex connection pool after all tests complete.
 */

import knex from 'knex';
import config from '../../knexfile';

const testDb = knex(config.development);

beforeAll(async () => {
  await testDb.migrate.latest();
});

afterAll(async () => {
  await testDb.destroy();
});

export default testDb;
