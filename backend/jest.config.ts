export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  // Runs after Jest's test framework is installed in the environment, so
  // beforeAll / afterAll inside setup.ts resolve correctly. The previous
  // `setupFilesAfterSetup` was not a real Jest option and was silently
  // ignored, leaving migrations un-run.
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
};
