// MediSlot | Mohammad Mubeen Khan | server/auth/routes.js
// Signup, login and "who am I". Mounted at /api/auth.
//
// Signup writes app_user and its subtype row (patient or doctor) in ONE
// transaction: if the subtype insert fails (bad dob, duplicate licence, ...)
// the app_user row is rolled back too, so there is never an account without
// its subtype. The (id, role) composite FK (R8) guarantees the subtype matches.
// Admin accounts are not created through signup.

const express = require('express');
const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../db');
const { HttpError } = require('../errors');
const { requireRole, signToken } = require('./requireRole');

const router = express.Router();

// public: list clinics and specialties for signup form dropdowns
router.get('/clinics', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT clinic_id, name, city FROM clinic ORDER BY city, name'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/specialties', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT specialty_id, name FROM specialty ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/signup', async (req, res, next) => {
  try {
    const { fullName, email, phone, password, role } = req.body;
    if (!fullName || !email || !phone || !password) {
      throw new HttpError(400, 'Name, email, phone and password are required');
    }
    if (password.length < 6) throw new HttpError(400, 'Password must be at least 6 characters');
    if (!['PATIENT', 'DOCTOR'].includes(role)) {
      throw new HttpError(400, 'Role must be PATIENT or DOCTOR');
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await withTransaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO app_user (full_name, email, phone, password_hash, role)
         VALUES ($1, lower($2), $3, $4, $5)
         RETURNING user_id, full_name, role`,
        [fullName, email, phone, hash, role]
      );
      const u = rows[0];

      if (role === 'PATIENT') {
        const { dob, gender } = req.body;
        await client.query(
          'INSERT INTO patient (patient_id, role, dob, gender) VALUES ($1, $2, $3, $4)',
          [u.user_id, role, dob || null, gender || null]
        );
      } else {
        let { clinicId, specialtyId, licenseNo, fee, experienceYrs,
              newClinicName, newClinicAddress, newClinicCity } = req.body;

        // create a new clinic on the fly if name provided
        if (newClinicName && newClinicName.trim()) {
          const cr = await client.query(
            `INSERT INTO clinic(name, address, city) VALUES($1, $2, $3)
             ON CONFLICT(name, address) DO UPDATE SET name=EXCLUDED.name
             RETURNING clinic_id`,
            [newClinicName.trim(), (newClinicAddress || '').trim(), (newClinicCity || '').trim()]
          );
          clinicId = cr.rows[0].clinic_id;
        }

        await client.query(
          `INSERT INTO doctor (doctor_id, role, clinic_id, specialty_id, license_no, fee, experience_yrs)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [u.user_id, role, clinicId || null, specialtyId || null, licenseNo || null, fee ?? null, experienceYrs ?? null]
        );
      }
      return u;
    });

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new HttpError(400, 'Email and password are required');

    const { rows } = await query(
      'SELECT user_id, full_name, role, password_hash FROM app_user WHERE email = lower($1)',
      [email]
    );
    const user = rows[0];
    // Same message either way, so the form does not reveal which emails exist
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new HttpError(401, 'Wrong email or password');
    }
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireRole(), (req, res) => {
  res.json({ user: req.user });
});

function publicUser(u) {
  return { id: u.user_id, name: u.full_name, role: u.role };
}

module.exports = router;
