const pg = require('pg');
const { Pool } = pg;
require('dotenv').config();

// Return DATE columns as strings to prevent timezone shifting
// OID 1082 is the PostgreSQL DATE type
pg.types.setTypeParser(1082, (val) => val);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
