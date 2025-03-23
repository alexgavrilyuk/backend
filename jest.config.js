module.exports = {
    testEnvironment: 'node',
    coverageDirectory: './coverage/',
    collectCoverage: true,
    collectCoverageFrom: [
      'controllers/**/*.js',
      'services/**/*.js',
      'utils/**/*.js',
      'middleware/**/*.js',
      '!**/node_modules/**',
      '!**/tests/**',
    ],
    coverageThreshold: {
      global: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
    testMatch: ['**/__tests__/**/*.js?(x)', '**/?(*.)+(spec|test).js?(x)'],
    verbose: true,
    testTimeout: 30000,
    setupFilesAfterEnv: ['./tests/setup.js'],
  };

