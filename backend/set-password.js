const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function setPassword() {
  const hash = await bcrypt.hash('test123', 10);
  await pool.query("UPDATE admins SET password_hash = $1 WHERE email = 'uslsis.batch2003@gmail.com'", [hash]);
  console.log('Password updated! New hash:', hash);
  process.exit(0);
}

setPassword();
Goldenbatch2003
