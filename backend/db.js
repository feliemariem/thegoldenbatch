const pg = require('pg');
const { Pool } = pg;
require('dotenv').config();

// Return DATE columns as strings to prevent timezone shifting
// OID 1082 is the PostgreSQL DATE type
pg.types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  // Explicit pool settings (pg defaults shown, adjust if needed)
  max: 10,                      // Maximum connections in pool
  idleTimeoutMillis: 30000,     // Close idle connections after 30s
  connectionTimeoutMillis: 5000 // Fail if can't connect in 5s
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
