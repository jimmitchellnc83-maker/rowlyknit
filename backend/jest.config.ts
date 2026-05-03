/**
 * `npm test` (default) runs UNIT tests only — no live Postgres needed.
 * Anything that requires a real DB lives in `*.integration.test.ts` and
 * is excluded from the default run via `testPathIgnorePatterns`. To
 * exercise the integration layer, run `npm run test:integration`.
 *
 * The split was added when database.ts stopped calling process.exit(1)
 * during module import. Before that, mocking the db module was the only
 * way to keep unit suites alive; now the suites run cleanly without the
 * DB and integration tests genuinely document the live-DB contract.
 */
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '\\.integration\\.test\\.ts$'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Runs after Jest's test framework is installed in the environment, so
  // beforeAll / afterAll inside setup.ts resolve correctly. The previous
  // `setupFilesAfterSetup` was not a real Jest option and was silently
  // ignored, leaving migrations un-run.
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
