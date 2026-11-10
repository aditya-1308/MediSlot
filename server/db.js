// MediSlot | Mohammad Mubeen Khan | server/db.js
// One shared pg connection pool. Route handlers call query() for single
// statements and withTransaction() when several statements must commit together.

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  // Every connection shows times in IST, matching sp_generate_slots
  options: '-c timezone=Asia/Kolkata',
});

function query(text, params) {
  return pool.query(text, params);
}

// Runs fn(client) inside BEGIN/COMMIT; any thrown error rolls everything back
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
