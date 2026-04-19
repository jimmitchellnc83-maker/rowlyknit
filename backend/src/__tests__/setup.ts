/**
 * Test setup and teardown for backend integration tests.
 *
 * PREREQUISITES for integration tests:
 *   - A running PostgreSQL instance reachable via DB_TEST_* env vars
 *     (defaults: localhost:5432, database rowly_test, user postgres).
 *
 * Unit tests that mock their dependencies (e.g. src/utils/__tests__/*.test.ts)
 * run fine without Postgres — this file's beforeAll/afterAll only execute in
 * suites that import testDb.
 */

import knex from 'knex';
import config from '../../knexfile';

const testDb = knex(config.test);

beforeAll(async () => {
  await testDb.migrate.latest();
});

afterAll(async () => {
  await testDb.destroy();
});

export default testDb;
