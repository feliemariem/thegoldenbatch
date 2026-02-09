module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFilesAfterEnv: ['./tests/setup.js'],
  testTimeout: 10000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  maxWorkers: 1,  // Run tests sequentially to avoid database conflicts
  coverageDirectory: './coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
  coverageThreshold: {
    './routes/auth.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './routes/permissions.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './middleware/auth.js': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  collectCoverageFrom: [
    'routes/**/*.js',
    'middleware/**/*.js',
    '!**/node_modules/**'
  ]
};
