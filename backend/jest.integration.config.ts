/**
 * Integration test runner — sister config to jest.config.ts.
 *
 * Targets `*.integration.test.ts` files that require a running Postgres
 * (configured via DB_TEST_* env vars). Default `npm test` skips these;
 * `npm run test:integration` runs them.
 */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.integration.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
