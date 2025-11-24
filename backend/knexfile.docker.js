// Docker production knexfile - uses compiled JavaScript migrations
// This file runs INSIDE the Docker container where paths start with /app

module.exports = {
  client: 'postgresql',
  connection: {
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'rowly_production',
    user: process.env.DB_USER || 'rowly_user',
    password: process.env.DB_PASSWORD,
  },
  pool: {
    min: 2,
    max: 10,
  },
  migrations: {
    directory: '/app/dist/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: '/app/dist/seeds',
  },
};
