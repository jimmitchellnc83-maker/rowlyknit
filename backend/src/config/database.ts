import knex, { Knex } from 'knex';
import knexConfig from '../../knexfile';
import logger from './logger';

const environment = process.env.NODE_ENV || 'development';
const config: Knex.Config = knexConfig[environment];

const db = knex(config);

// Test connection
db.raw('SELECT 1')
  .then(() => {
    logger.info('Database connection established');
  })
  .catch((err) => {
    logger.error('Database connection failed', { error: err.message });
    process.exit(1);
  });

export default db;
