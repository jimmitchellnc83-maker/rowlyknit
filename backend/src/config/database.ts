import knex, { Knex } from 'knex';
import knexConfig from '../../knexfile';

const environment = process.env.NODE_ENV || 'development';
const config: Knex.Config = knexConfig[environment];

const db = knex(config);

// Test connection
db.raw('SELECT 1')
  .then(() => {
    console.log('✓ Database connection established');
  })
  .catch((err) => {
    console.error('✗ Database connection failed:', err.message);
    process.exit(1);
  });

export default db;
