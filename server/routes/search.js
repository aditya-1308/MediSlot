
// MediSlot | Avinash | server/routes/search.js
// Doctor search with filters and upcoming free appointment slots.

const express = require('express');
const { query } = require('../db');
const { HttpError } = require('../errors');
const { requireRole } = require('../auth/requireRole');

const router = express.Router();

function optionalInt(value, name) {
  if (value === undefined || value === '') return null;

  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new HttpError(400, `${name} must be a positive whole number`);
  }

  return n;
}

function optionalDate(value) {
  if (value === undefined || value === '') return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, 'date must be in YYYY-MM-DD format');
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new HttpError(400, 'Invalid date');
  }

  return value;
}

// GET /api/search/doctors
// Query parameters:
// q, city, specialtyId, date
router.get('/search/doctors', requireRole('PATIENT'), async (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const city = typeof req.query.city === 'string' ? req.query.city.trim() : '';
    const specialtyId = optionalInt(req.query.specialtyId, 'specialtyId');
    const date = optionalDate(req.query.date);

    if (q.length > 100 || city.length > 100) {
      throw new HttpError(400, 'Search filters are too long');
    }

    const { rows } = await query(
      `
      WITH ranked_slots AS (
        SELECT
          sl.slot_id,
          sl.doctor_id,
          sl.slot_start,
          sl.slot_end,
          ROW_NUMBER() OVER (
            PARTITION BY sl.doctor_id
            ORDER BY sl.slot_start
          ) AS slot_rank
        FROM slot sl
        WHERE
          sl.status = 'FREE'
          AND sl.slot_start > NOW()
          AND (
            $4::date IS NULL
            OR (
              sl.slot_start >= (
                $4::date::timestamp AT TIME ZONE 'Asia/Kolkata'
              )
              AND sl.slot_start < (
                ($4::date + 1)::timestamp AT TIME ZONE 'Asia/Kolkata'
              )
            )
          )
      )
      SELECT
        d.doctor_id,
        u.full_name AS doctor_name,
        sp.specialty_id,
        sp.name AS specialty,
        d.experience_yrs,
        d.fee,
        c.clinic_id,
        c.name AS clinic_name,
        c.address AS clinic_address,
        c.city,
        rs.slot_id,
        rs.slot_start,
        rs.slot_end
      FROM doctor d
      JOIN app_user u
        ON u.user_id = d.doctor_id
      JOIN specialty sp
        ON sp.specialty_id = d.specialty_id
      JOIN clinic c
        ON c.clinic_id = d.clinic_id
      JOIN ranked_slots rs
        ON rs.doctor_id = d.doctor_id
       AND rs.slot_rank <= 3
      WHERE
        ($1::text = '' OR u.full_name ILIKE '%' || $1 || '%')
        AND ($2::text = '' OR c.city ILIKE '%' || $2 || '%')
        AND ($3::integer IS NULL OR d.specialty_id = $3)
      ORDER BY d.doctor_id, rs.slot_start
      `,
      [q, city, specialtyId, date]
    );

    // Group the slot rows under each doctor.
    const doctors = new Map();

    for (const row of rows) {
      if (!doctors.has(row.doctor_id)) {
        doctors.set(row.doctor_id, {
          doctor_id: row.doctor_id,
          doctor_name: row.doctor_name,
          specialty_id: row.specialty_id,
          specialty: row.specialty,
          experience_yrs: row.experience_yrs,
          fee: row.fee,
          clinic_id: row.clinic_id,
          clinic_name: row.clinic_name,
          clinic_address: row.clinic_address,
          city: row.city,
          slots: []
        });
      }

      doctors.get(row.doctor_id).slots.push({
        slot_id: row.slot_id,
        slot_start: row.slot_start,
        slot_end: row.slot_end
      });
    }

    res.json(Array.from(doctors.values()));
  } catch (err) {
    next(err);
  }
});

// GET /api/search/specialties
router.get('/search/specialties', requireRole('PATIENT'), async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT specialty_id, name FROM specialty ORDER BY name'
    );

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/search/cities
router.get('/search/cities', requireRole('PATIENT'), async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT DISTINCT city FROM clinic ORDER BY city'
    );

    res.json(rows.map((row) => row.city));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
