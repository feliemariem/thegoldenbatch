/**
 * Setup Script: Create your admin account
 * 
 * Usage: node setup-admin.js <email> <password>
 * Example: node setup-admin.js admin@example.com mypassword123
 */

const bcrypt = require('bcrypt');
const db = require('./db');
require('dotenv').config();

async function createAdmin() {
  const email = process.argv[2];
  const password = process.argv[3];

  if (!email || !password) {
    console.log('Usage: node setup-admin.js <email> <password>');
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(password, 10);
    
    const result = await db.query(
      'INSERT INTO admins (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email.toLowerCase(), hash]
    );

    console.log('Admin created successfully!');
    console.log('Email:', result.rows[0].email);
    console.log('\nYou can now login at http://localhost:3000/login');
    
    process.exit(0);
  } catch (err) {
    if (err.code === '23505') {
      console.log('Error: Admin with this email already exists');
    } else {
      console.error('Error:', err.message);
    }
    process.exit(1);
  }
}

createAdmin();
