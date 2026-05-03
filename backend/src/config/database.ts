import knex, { Knex } from 'knex';
import knexConfig from '../../knexfile';
import logger from './logger';

const environment = process.env.NODE_ENV || 'development';
const config: Knex.Config = knexConfig[environment];

const db = knex(config);

/**
 * Readiness probe — separated from module import on purpose. Importing
 * `database.ts` previously fired `SELECT 1` and `process.exit(1)` on
 * failure, which killed every Jest unit suite the moment any module in
 * its graph touched the db (transitively, that's most of them). The
 * connection check now lives behind a function, called from server
 * startup and `/health`. Unit tests can mock the module without ever
 * hitting Postgres.
 */
export async function checkDatabaseConnection(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.raw('SELECT 1');
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Convenience wrapper: log the result and (in non-test envs) exit on
 * failure. Server startup calls this; tests do not.
 */
export async function assertDatabaseReady(): Promise<void> {
  const result = await checkDatabaseConnection();
  if (result.ok) {
    logger.info('Database connection established');
    return;
  }
  logger.error('Database connection failed', { error: result.error });
  if (process.env.NODE_ENV !== 'test') {
    process.exit(1);
  }
  throw new Error(`Database connection failed: ${result.error}`);
}

export default db;
