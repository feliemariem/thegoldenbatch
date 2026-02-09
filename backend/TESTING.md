# Testing Guide

This document explains how to set up and run tests for The Golden Batch Alumni RSVP system backend.

## Prerequisites

- Node.js (v18+)
- PostgreSQL running locally
- npm or yarn

## Test Database Setup

### 1. Create the test database

```bash
# Connect to PostgreSQL and create the test database
createdb test_alumni_homecoming

# Or using psql:
psql -c "CREATE DATABASE test_alumni_homecoming;"
```

### 2. Configure test environment

Copy `.env.test` and adjust if needed:

```bash
# The default values should work for local development:
TEST_DATABASE_URL=postgresql://localhost:5432/test_alumni_homecoming
JWT_SECRET=test-jwt-secret-do-not-use-in-production
NODE_ENV=test
```

### 3. Initialize the test database

You can either:

**Option A:** Let the test setup handle it automatically (recommended)
- The test setup (`tests/setup.js`) will run the schema automatically before tests

**Option B:** Manually initialize
```bash
psql -d test_alumni_homecoming -f tests/test-db-setup.sql
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode (re-runs on file changes)
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

### Run specific test files
```bash
# Auth tests only
npm run test:auth

# Permission tests only
npm run test:permissions

# Invites API tests
npm run test:invites

# Users API tests
npm run test:users

# Ledger (financial) API tests
npm run test:ledger

# Events API tests
npm run test:events

# Or specify any test file directly
npm test -- tests/invites.test.js
```

### Reset test database
If test data becomes corrupted or you need a fresh start:
```bash
npm run test:reset-db
```

## Test Structure

```
backend/
├── tests/
│   ├── setup.js           # Global test setup (DB connection, seed data)
│   ├── helpers.js         # Test utilities (token generation, etc.)
│   ├── auth.test.js       # Authentication endpoint tests (50+ tests)
│   ├── permissions.test.js # Permission system tests (30+ tests)
│   ├── invites.test.js    # Invite management tests (40+ tests)
│   ├── users.test.js      # User profile API tests (20+ tests)
│   ├── ledger.test.js     # Financial ledger API tests (35+ tests)
│   ├── events.test.js     # Events API tests (30+ tests)
│   ├── test-db-setup.sql  # Manual DB initialization script
│   └── reset-test-db.js   # Database reset script
├── jest.config.js         # Jest configuration
└── .env.test              # Test environment variables
```

## Writing New Tests

### Test file naming
- Name test files with `.test.js` suffix
- Place in the `tests/` directory

### Test structure
```javascript
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

// Set up test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-do-not-use-in-production';

const { getTestPool, truncateTables, seedTestData } = require('./setup');
const { createAdminToken, createUserToken } = require('./helpers');

// Mock external services
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }])
}));

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/your-route', require('../routes/your-route'));
  return app;
};

describe('Your API', () => {
  let app;
  let pool;

  beforeAll(() => {
    app = createTestApp();
    pool = getTestPool();
  });

  beforeEach(async () => {
    // Reset data before each test
    await truncateTables();
    await seedTestData();
  });

  describe('GET /api/your-route', () => {
    it('should do something', async () => {
      const token = createAdminToken(1, 'admin@test.com');

      const response = await request(app)
        .get('/api/your-route')
        .set('Cookie', `token=${token}`);

      expect(response.status).toBe(200);
    });
  });
});
```

### Available test helpers

```javascript
const {
  generateTestToken,      // Generate a custom JWT token
  generateExpiredToken,   // Generate an expired token
  generateTamperedToken,  // Generate an invalid token
  createUserToken,        // Create a non-admin user token
  createAdminToken,       // Create an admin token
  createSuperAdminToken,  // Create a super admin token
  withAuth,               // Helper to set auth cookie on request
  cleanupTables           // Truncate specific tables
} = require('./helpers');
```

### Database helpers

```javascript
const {
  getTestPool,      // Get the test database pool
  setupDatabase,    // Run schema.sql
  seedTestData,     // Insert minimal test data
  truncateTables,   // Clear all tables
  closeConnections  // Close DB connections
} = require('./setup');
```

## Test Data

The seed data includes:

| Type | Email | Password | Notes |
|------|-------|----------|-------|
| Super Admin | admin@test.com | admin123 | Has all permissions |
| Regular Admin | regularadmin@test.com | admin123 | Limited permissions |
| User | testuser@test.com | user123 | Regular registered user |
| Invite (unused) | newuser@test.com | - | Token: valid-invite-token-123 |
| Invite (used) | useduser@test.com | - | Token: used-invite-token-456 |

## Coverage Thresholds

The following files have 80% coverage requirements:
- `routes/auth.js`
- `routes/permissions.js`
- `middleware/auth.js`

Run `npm run test:coverage` to check current coverage levels.

## Troubleshooting

### Tests are failing with database connection errors

1. Make sure PostgreSQL is running
2. Verify the `TEST_DATABASE_URL` in `.env.test`
3. Make sure the `test_alumni_homecoming` database exists

### Tests are hanging

This usually means database connections aren't being closed. Check:
- The `afterAll` hook in your test file
- The `forceExit: true` option in jest.config.js should handle this

### Rate limiting affecting tests

Rate limiters are active in tests. If you're hitting rate limits:
- Tests should reset between runs
- Check that `truncateTables()` is being called in `beforeEach`

### Mock not working for SendGrid

Make sure you mock **before** requiring the routes:

```javascript
// This must come BEFORE require('../routes/auth')
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }])
}));

// Now require routes
const authRoutes = require('../routes/auth');
```

## Continuous Integration

For CI environments, set these environment variables:

```bash
TEST_DATABASE_URL=postgresql://postgres:password@localhost:5432/test_alumni_homecoming
JWT_SECRET=ci-test-secret
NODE_ENV=test
```

Example GitHub Actions workflow:

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_alumni_homecoming
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
        env:
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_alumni_homecoming
          JWT_SECRET: ci-test-secret
```
