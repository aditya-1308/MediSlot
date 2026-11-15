// MediSlot | server/routes/admin.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../db');
const { requireRole } = require('../auth/requireRole');

const DEFAULT_CLINIC_ID = Number(process.env.ADMIN_CLINIC_ID || 1);

// Protect /api/admin routes for ADMIN role only
router.use('/admin', requireRole('ADMIN'));

// Resolve the single clinic managed by this admin
async function resolveAdminClinic(userId) {
  const colCheck = await db.query(`
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'app_user' AND column_name = 'clinic_id'
  `);
  let clinicId = DEFAULT_CLINIC_ID;
  if (colCheck.rowCount > 0) {
    const uRes = await db.query(`SELECT clinic_id FROM app_user WHERE user_id = $1`, [userId]);
    if (uRes.rows[0]?.clinic_id) clinicId = uRes.rows[0].clinic_id;
  }
  const cRes = await db.query(
    `SELECT clinic_id, name, address, city FROM clinic WHERE clinic_id = $1`,
    [clinicId]
  );
  if (cRes.rows.length) return cRes.rows[0];
  const fallback = await db.query(
    `SELECT clinic_id, name, address, city FROM clinic ORDER BY clinic_id ASC LIMIT 1`
  );
  return fallback.rows[0];
}

// Hash password matching your auth setup
async function hashPassword(plain) {
  try {
    const bcrypt = require('bcryptjs');
    return await bcrypt.hash(plain, 10);
  } catch {
    try {
      const bcrypt = require('bcrypt');
      return await bcrypt.hash(plain, 10);
    } catch {
      return crypto.createHash('sha256').update(plain).digest('hex');
    }
  }
}

// ---------------------------------------------------------------------------
// 1. CLINIC-SCOPED DASHBOARD SUMMARY
// ---------------------------------------------------------------------------
router.get('/admin/dashboard', async (req, res, next) => {
  try {
    const clinic = await resolveAdminClinic(req.user.id);
    if (!clinic) return res.status(404).json({ error: 'No clinic configured.' });
    const cid = clinic.clinic_id;

    const [countsRes, demandRes, recentApptsRes] = await Promise.all([
      db.query(
        `
        SELECT
          (SELECT COUNT(*)::int FROM doctor WHERE clinic_id = $1) AS doctors,
          (SELECT COUNT(*)::int FROM specialty) AS specialties,
          (SELECT COUNT(*)::int FROM medicine) AS medicines,
          (SELECT COUNT(*)::int
             FROM slot s
             JOIN doctor d ON d.doctor_id = s.doctor_id
            WHERE d.clinic_id = $1 AND s.status = 'FREE' AND s.slot_start >= NOW()) AS open_slots,
          (SELECT COUNT(*)::int
             FROM appointment a
             JOIN slot s ON s.slot_id = a.slot_id
             JOIN doctor d ON d.doctor_id = s.doctor_id
            WHERE d.clinic_id = $1 AND a.status = 'BOOKED' AND s.slot_start >= NOW()) AS upcoming_bookings,
          (SELECT COUNT(*)::int
             FROM appointment a
             JOIN slot s ON s.slot_id = a.slot_id
             JOIN doctor d ON d.doctor_id = s.doctor_id
            WHERE d.clinic_id = $1 AND (a.status <> 'BOOKED' OR s.slot_start < NOW())) AS past_appointments,
          (SELECT COALESCE(SUM(p.amount - COALESCE(p.refund_amount, 0)), 0)
             FROM payment p
             JOIN appointment a ON a.appt_id = p.appt_id
             JOIN slot s ON s.slot_id = a.slot_id
             JOIN doctor d ON d.doctor_id = s.doctor_id
            WHERE d.clinic_id = $1) AS net_revenue
        `,
        [cid]
      ),
      db.query(
        `
        SELECT sp.specialty_id, sp.name AS specialty_name,
               COUNT(DISTINCT d.doctor_id)::int AS total_doctors_count,
               COUNT(a.appt_id)::int AS total_appointments
        FROM specialty sp
        LEFT JOIN doctor d ON d.specialty_id = sp.specialty_id AND d.clinic_id = $1
        LEFT JOIN slot s ON s.doctor_id = d.doctor_id
        LEFT JOIN appointment a ON a.slot_id = s.slot_id
        GROUP BY sp.specialty_id, sp.name
        HAVING COUNT(DISTINCT d.doctor_id) > 0 OR COUNT(a.appt_id) > 0
        ORDER BY total_appointments DESC, sp.name ASC
        LIMIT 6
        `,
        [cid]
      ),
      db.query(
        `
        SELECT a.appt_id, a.status, s.slot_start,
               u_doc.full_name AS doctor_name, u_pat.full_name AS patient_name,
               sp.name AS specialty_name
        FROM appointment a
        JOIN slot s ON s.slot_id = a.slot_id
        JOIN doctor d ON d.doctor_id = s.doctor_id
        JOIN specialty sp ON sp.specialty_id = d.specialty_id
        JOIN app_user u_doc ON u_doc.user_id = d.doctor_id
        JOIN patient p ON p.patient_id = a.patient_id
        JOIN app_user u_pat ON u_pat.user_id = p.patient_id
        WHERE d.clinic_id = $1
        ORDER BY s.slot_start DESC
        LIMIT 8
        `,
        [cid]
      ),
    ]);

    res.json({
      clinic,
      stats: countsRes.rows[0],
      specialtyDemand: demandRes.rows,
      recentAppointments: recentApptsRes.rows,
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 2. CLINIC DOCTORS (LIST, CREATE NEW, MODIFY EXISTING)
// ---------------------------------------------------------------------------
router.get('/admin/doctors', async (req, res, next) => {
  try {
    const clinic = await resolveAdminClinic(req.user.id);
    const { rows } = await db.query(
      `
      SELECT d.doctor_id, u.full_name, u.email, u.phone,
             d.specialty_id, sp.name AS specialty_name,
             d.fee, d.license_no, d.experience_yrs
      FROM doctor d
      JOIN app_user u ON u.user_id = d.doctor_id
      JOIN specialty sp ON sp.specialty_id = d.specialty_id
      WHERE d.clinic_id = $1
      ORDER BY u.full_name ASC
      `,
      [clinic.clinic_id]
    );
    res.json({ clinic, doctors: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/doctors', async (req, res, next) => {
  try {
    const clinic = await resolveAdminClinic(req.user.id);
    const {
      full_name,
      email,
      phone,
      password,
      specialty_id,
      fee,
      license_no,
      experience_yrs,
    } = req.body;

    if (!full_name?.trim() || !email?.trim() || !password?.trim() || !specialty_id || !license_no?.trim()) {
      return res.status(400).json({
        error: 'Full name, email, initial password, specialty, and license number are required.',
      });
    }

    const numericFee = Number(fee ?? 500);
    const numericExp = Number(experience_yrs ?? 0);
    if (Number.isNaN(numericFee) || numericFee < 0) {
      return res.status(400).json({ error: 'Consultation fee must be a valid non-negative number.' });
    }

    const passwordHash = await hashPassword(password.trim());

    // Atomic single-query insert across app_user and doctor
    const { rows } = await db.query(
      `
      WITH new_user AS (
        INSERT INTO app_user (full_name, email, phone, password_hash, role)
        VALUES ($1, $2, $3, $4, 'DOCTOR')
        RETURNING user_id, full_name, email, phone
      ),
      new_doc AS (
        INSERT INTO doctor (doctor_id, role, clinic_id, specialty_id, license_no, fee, experience_yrs)
        SELECT user_id, 'DOCTOR', $5, $6, $7, $8, $9
        FROM new_user
        RETURNING doctor_id, clinic_id, specialty_id, license_no, fee, experience_yrs
      )
      SELECT nu.user_id AS doctor_id, nu.full_name, nu.email, nu.phone,
             nd.clinic_id, nd.specialty_id, nd.license_no, nd.fee, nd.experience_yrs
      FROM new_user nu
      JOIN new_doc nd ON nd.doctor_id = nu.user_id
      `,
      [
        full_name.trim(),
        email.trim().toLowerCase(),
        phone?.trim() || null,
        passwordHash,
        clinic.clinic_id,
        Number(specialty_id),
        license_no.trim(),
        numericFee,
        numericExp,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email or license number already exists.' });
    }
    next(err);
  }
});

router.put('/admin/doctors/:id', async (req, res, next) => {
  try {
    const clinic = await resolveAdminClinic(req.user.id);
    const doctorId = Number(req.params.id);
    const {
      full_name,
      email,
      phone,
      password,
      specialty_id,
      fee,
      license_no,
      experience_yrs,
    } = req.body;

    if (!full_name?.trim() || !email?.trim() || !specialty_id || !license_no?.trim()) {
      return res.status(400).json({
        error: 'Full name, email, specialty, and license number are required.',
      });
    }

    const numericFee = Number(fee ?? 0);
    const numericExp = Number(experience_yrs ?? 0);

    const check = await db.query(
      `SELECT doctor_id FROM doctor WHERE doctor_id = $1 AND clinic_id = $2`,
      [doctorId, clinic.clinic_id]
    );
    if (!check.rowCount) {
      return res.status(404).json({ error: 'Doctor not found in your clinic.' });
    }

    if (password && password.trim()) {
      const passwordHash = await hashPassword(password.trim());
      await db.query(
        `UPDATE app_user
         SET full_name = $1, email = $2, phone = $3, password_hash = $4
         WHERE user_id = $5`,
        [full_name.trim(), email.trim().toLowerCase(), phone?.trim() || null, passwordHash, doctorId]
      );
    } else {
      await db.query(
        `UPDATE app_user
         SET full_name = $1, email = $2, phone = $3
         WHERE user_id = $4`,
        [full_name.trim(), email.trim().toLowerCase(), phone?.trim() || null, doctorId]
      );
    }

    const docRes = await db.query(
      `UPDATE doctor
       SET specialty_id = $1,
           license_no = $2,
           fee = $3,
           experience_yrs = $4
       WHERE doctor_id = $5 AND clinic_id = $6
       RETURNING doctor_id, clinic_id, specialty_id, license_no, fee, experience_yrs`,
      [Number(specialty_id), license_no.trim(), numericFee, numericExp, doctorId, clinic.clinic_id]
    );

    res.json({
      doctor_id: doctorId,
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || null,
      ...docRes.rows[0],
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email or license number is already used by another doctor.' });
    }
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 3. DOCTOR SLOTS (LIST, CREATE SINGLE / BULK, UPDATE, DELETE)
// ---------------------------------------------------------------------------
router.get('/admin/slots', async (req, res, next) => {
  try {
    const clinic = await resolveAdminClinic(req.user.id);
    const doctorFilter = req.query.doctor_id ? Number(req.query.doctor_id) : null;

    const params = [clinic.clinic_id];
    let whereExtra = '';
    if (doctorFilter) {
      params.push(doctorFilter);
      whereExtra = `AND d.doctor_id = $2`;
    }

    const { rows } = await db.query(
      `
      SELECT s.slot_id,
             s.doctor_id,
             u.full_name AS doctor_name,
             sp.name AS specialty_name,
             s.slot_start,
             s.slot_end,
             s.status,
             (s.status <> 'FREE' OR a.appt_id IS NOT NULL) AS is_booked,
             a.appt_id,
             a.status AS appt_status,
             u_pat.full_name AS patient_name
      FROM slot s
      JOIN doctor d ON d.doctor_id = s.doctor_id
      JOIN app_user u ON u.user_id = d.doctor_id
      JOIN specialty sp ON sp.specialty_id = d.specialty_id
      LEFT JOIN appointment a ON a.slot_id = s.slot_id AND a.status = 'BOOKED'
      LEFT JOIN app_user u_pat ON u_pat.user_id = a.patient_id
      WHERE d.clinic_id = $1 ${whereExtra}
      ORDER BY s.slot_start DESC
      `,
      params
    );
    res.json({ clinic, slots: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/slots', async (req, res, next) => {
  try {
    const clinic = await resolveAdminClinic(req.user.id);
    const { doctor_id, date, start_time, end_time, duration_mins } = req.body;

    if (!doctor_id || !date || !start_time || !end_time) {
      return res.status(400).json({
        error: 'Doctor, date, start time, and end time are required.',
      });
    }

    const docCheck = await db.query(
      `SELECT doctor_id FROM doctor WHERE doctor_id = $1 AND clinic_id = $2`,
      [Number(doctor_id), clinic.clinic_id]
    );
    if (!docCheck.rowCount) {
      return res.status(404).json({ error: 'Doctor not found in your clinic.' });
    }

    const startDt = new Date(`${date}T${start_time}`);
    const endDt = new Date(`${date}T${end_time}`);
    if (Number.isNaN(startDt.getTime()) || Number.isNaN(endDt.getTime()) || endDt <= startDt) {
      return res.status(400).json({ error: 'End time must be after start time.' });
    }

    const stepMins = Number(duration_mins || 0);
    const intervals = [];

    if (stepMins > 0) {
      let cursor = new Date(startDt);
      while (cursor.getTime() + stepMins * 60000 <= endDt.getTime()) {
        const nextCursor = new Date(cursor.getTime() + stepMins * 60000);
        intervals.push([new Date(cursor), nextCursor]);
        cursor = nextCursor;
      }
      if (!intervals.length) {
        return res.status(400).json({
          error: 'Time range is shorter than the selected slot duration.',
        });
      }
    } else {
      intervals.push([startDt, endDt]);
    }

    // Validate all intervals for overlap before inserting
    for (const [sStart, sEnd] of intervals) {
      const overlap = await db.query(
        `SELECT 1 FROM slot
         WHERE doctor_id = $1
           AND slot_start < $3
           AND slot_end > $2`,
        [Number(doctor_id), sStart.toISOString(), sEnd.toISOString()]
      );
      if (overlap.rowCount) {
        return res.status(409).json({
          error: `Slot ${sStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} overlaps an existing slot for this doctor.`,
        });
      }
    }

    const created = [];
    for (const [sStart, sEnd] of intervals) {
      const ins = await db.query(
        `INSERT INTO slot (doctor_id, slot_start, slot_end, status)
         VALUES ($1, $2, $3, 'FREE')
         RETURNING slot_id, doctor_id, slot_start, slot_end, status`,
        [Number(doctor_id), sStart.toISOString(), sEnd.toISOString()]
      );
      created.push(ins.rows[0]);
    }

    res.status(201).json({ count: created.length, slots: created });
  } catch (err) {
    next(err);
  }
});

router.put('/admin/slots/:id', async (req, res, next) => {
  try {
    const clinic = await resolveAdminClinic(req.user.id);
    const slotId = Number(req.params.id);
    const { doctor_id, date, start_time, end_time } = req.body;

    if (!doctor_id || !date || !start_time || !end_time) {
      return res.status(400).json({
        error: 'Doctor, date, start time, and end time are required.',
      });
    }

    const startDt = new Date(`${date}T${start_time}`);
    const endDt = new Date(`${date}T${end_time}`);
    if (Number.isNaN(startDt.getTime()) || Number.isNaN(endDt.getTime()) || endDt <= startDt) {
      return res.status(400).json({ error: 'End time must be after start time.' });
    }

    const existing = await db.query(
      `SELECT s.slot_id, s.status
       FROM slot s
       JOIN doctor d ON d.doctor_id = s.doctor_id
       WHERE s.slot_id = $1 AND d.clinic_id = $2`,
      [slotId, clinic.clinic_id]
    );
    if (!existing.rowCount) {
      return res.status(404).json({ error: 'Slot not found in your clinic.' });
    }
    if (existing.rows[0].status !== 'FREE') {
      return res.status(409).json({ error: 'Booked or closed slots cannot be modified.' });
    }

    const overlap = await db.query(
      `SELECT 1 FROM slot
       WHERE doctor_id = $1
         AND slot_id <> $2
         AND slot_start < $4
         AND slot_end > $3`,
      [Number(doctor_id), slotId, startDt.toISOString(), endDt.toISOString()]
    );
    if (overlap.rowCount) {
      return res.status(409).json({ error: 'Updated time overlaps another slot for this doctor.' });
    }

    const { rows } = await db.query(
      `UPDATE slot
       SET doctor_id = $1, slot_start = $2, slot_end = $3
       WHERE slot_id = $4
       RETURNING slot_id, doctor_id, slot_start, slot_end, status`,
      [Number(doctor_id), startDt.toISOString(), endDt.toISOString(), slotId]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/admin/slots/:id', async (req, res, next) => {
  try {
    const clinic = await resolveAdminClinic(req.user.id);
    const slotId = Number(req.params.id);

    const existing = await db.query(
      `SELECT s.status
       FROM slot s
       JOIN doctor d ON d.doctor_id = s.doctor_id
       WHERE s.slot_id = $1 AND d.clinic_id = $2`,
      [slotId, clinic.clinic_id]
    );
    if (!existing.rowCount) {
      return res.status(404).json({ error: 'Slot not found in your clinic.' });
    }
    if (existing.rows[0].status !== 'FREE') {
      return res.status(409).json({ error: 'Booked slots cannot be deleted.' });
    }

    await db.query(`DELETE FROM slot WHERE slot_id = $1`, [slotId]);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 4. CLINIC APPOINTMENTS (UPCOMING & PAST)
// ---------------------------------------------------------------------------
router.get('/admin/appointments', async (req, res, next) => {
  try {
    const clinic = await resolveAdminClinic(req.user.id);
    const { rows } = await db.query(
      `
      SELECT a.appt_id,
             a.status,
             a.booked_at,
             a.reason,
             s.slot_id,
             s.slot_start,
             s.slot_end,
             d.doctor_id,
             u_doc.full_name AS doctor_name,
             sp.name AS specialty_name,
             p.patient_id,
             u_pat.full_name AS patient_name,
             u_pat.email AS patient_email,
             pay.amount AS fee_paid,
             pay.refund_amount,
             pay.status AS payment_status
      FROM appointment a
      JOIN slot s ON s.slot_id = a.slot_id
      JOIN doctor d ON d.doctor_id = s.doctor_id
      JOIN specialty sp ON sp.specialty_id = d.specialty_id
      JOIN app_user u_doc ON u_doc.user_id = d.doctor_id
      JOIN patient p ON p.patient_id = a.patient_id
      JOIN app_user u_pat ON u_pat.user_id = p.patient_id
      LEFT JOIN payment pay ON pay.appt_id = a.appt_id
      WHERE d.clinic_id = $1
      ORDER BY s.slot_start DESC
      `,
      [clinic.clinic_id]
    );
    res.json({ clinic, appointments: rows });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 5. SPECIALTIES CRUD
// ---------------------------------------------------------------------------
router.get('/admin/specialties', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT specialty_id, name FROM specialty ORDER BY name ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/admin/specialties', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Specialty name is required.' });
    }
    const { rows } = await db.query(
      `INSERT INTO specialty (name) VALUES ($1) RETURNING specialty_id, name`,
      [name.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/admin/specialties/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Specialty name is required.' });
    }
    const { rows } = await db.query(
      `UPDATE specialty SET name = $1 WHERE specialty_id = $2 RETURNING specialty_id, name`,
      [name.trim(), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Specialty not found.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/admin/specialties/:id', async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM specialty WHERE specialty_id = $1`,
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Specialty not found.' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// 6. MEDICINES CRUD
// ---------------------------------------------------------------------------
router.get('/admin/medicines', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT medicine_id, name, form, strength FROM medicine ORDER BY name ASC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/admin/medicines', async (req, res, next) => {
  try {
    const { name, form, strength } = req.body;
    if (!name?.trim() || !form?.trim() || !strength?.trim()) {
      return res.status(400).json({ error: 'Medicine name, dosage form, and strength are required.' });
    }
    const { rows } = await db.query(
      `INSERT INTO medicine (name, form, strength)
       VALUES ($1, $2, $3)
       RETURNING medicine_id, name, form, strength`,
      [name.trim(), form.trim().toUpperCase(), strength.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/admin/medicines/:id', async (req, res, next) => {
  try {
    const { name, form, strength } = req.body;
    if (!name?.trim() || !form?.trim() || !strength?.trim()) {
      return res.status(400).json({ error: 'Medicine name, dosage form, and strength are required.' });
    }
    const { rows } = await db.query(
      `UPDATE medicine
       SET name = $1, form = $2, strength = $3
       WHERE medicine_id = $4
       RETURNING medicine_id, name, form, strength`,
      [name.trim(), form.trim().toUpperCase(), strength.trim(), req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Medicine not found.' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/admin/medicines/:id', async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      `DELETE FROM medicine WHERE medicine_id = $1`,
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Medicine not found.' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;