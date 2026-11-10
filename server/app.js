// MediSlot | Mohammad Mubeen Khan | server/app.js
// Express entry point: React frontend <-> this API <-> PostgreSQL.
//
// Contract (everyone): put your router in server/routes/<area>.js and export
// an express.Router(). Every file in routes/ is mounted at /api automatically,
// so write full paths inside it (e.g. router.get('/medicines', ...) in admin.js
// serves GET /api/medicines). You never need to edit this file.

require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { pool } = require('./db');
const { errorHandler } = require('./errors');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Copy server/.env.example to server/.env');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT now() AS db_time');
    res.json({ ok: true, dbTime: rows[0].db_time });
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', require('./auth/routes'));

const routesDir = path.join(__dirname, 'routes');
for (const file of fs.readdirSync(routesDir).filter((f) => f.endsWith('.js')).sort()) {
  app.use('/api', require(path.join(routesDir, file)));
  console.log(`Mounted routes/${file}`);
}

app.use('/api', (req, res) => res.status(404).json({ error: `No route for ${req.method} ${req.originalUrl}` }));
app.use(errorHandler);

const port = Number(process.env.PORT) || 4000;
if (require.main === module) {
  app.listen(port, () => console.log(`MediSlot API on http://localhost:${port}`));
}

module.exports = app;
