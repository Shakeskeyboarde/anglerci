/*
 * For a detailed explanation regarding each configuration property and type check, visit:
 * https://jestjs.io/docs/configuration
 */

const ignorePatterns = ['/node_modules/', '/\\.', '/_', '/index\\.tsx?$', '\\.d\\.ts$'];

/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  bail: 0,
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
  coverageDirectory: 'out/coverage',
  coveragePathIgnorePatterns: ignorePatterns,
  coverageProvider: 'v8',
  coverageReporters: ['text-summary', 'html-spa', 'lcov'],
  coverageThreshold: { global: { branches: 0, functions: 0, lines: 0, statements: 0 } },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  moduleNameMapper: {
    // Remove the .js extension (required for ES Module support) from TS file imports.
    '^(\\.{1,2}/.*)\\.jsx?$': '$1',
  },
  restoreMocks: true,
  roots: ['src'],
  setupFilesAfterEnv: [],
  testEnvironment: 'node',
  testPathIgnorePatterns: ignorePatterns,
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', { diagnostics: { ignoreCodes: [151001] }, useESM: true }],
  },
  transformIgnorePatterns: [],
  verbose: true,
};
