const express = require('express');
const { query } = require('../db');
const { HttpError } = require('../errors');
const { requireRole } = require('../auth/requireRole');

const router = express.Router();
router.use('/doctor', requireRole('DOCTOR'));

const VIEWS = new Set(['today', 'upcoming', 'past', 'all']);

const handle = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

function intParam(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new HttpError(400, `${name} must be a positive whole number`);
  }
  return n;
}

function intField(value, name) {
  if (
    value === undefined ||
    value === null ||
    typeof value === 'boolean' ||
    (typeof value === 'string' && !value.trim())
  ) {
    throw new HttpError(400, `${name} is required`);
  }
  const n = Number(value);
  if (!Number.isInteger(n)) {
    throw new HttpError(400, `${name} must be a whole number`);
  }
  return n;
}

function requiredText(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${name} is required`);
  }
  return value.trim();
}

router.get('/doctor/profile', handle(async (req, res) => {
  const { rows } = await query(
    `SELECT doctor_id, full_name, email, phone, license_no, fee,
            experience_yrs, specialty, clinic_name, clinic_address, city
     FROM v_doctor_profile
     WHERE doctor_id = $1`,
    [req.user.id]
  );
  if (!rows[0]) {
    throw new HttpError(404, 'Doctor profile not found');
  }
  res.json({ profile: rows[0] });
}));

router.get('/doctor/availability', handle(async (req, res) => {
  const { rows } = await query(
    `SELECT avail_id, doctor_id, weekday,
            to_char(start_time, 'HH24:MI') AS start_time,
            to_char(end_time, 'HH24:MI') AS end_time,
            slot_minutes
     FROM availability
     WHERE doctor_id = $1
     ORDER BY weekday, start_time`,
    [req.user.id]
  );
  res.json({ availability: rows });
}));

router.post('/doctor/availability', handle(async (req, res) => {
  const body = req.body || {};
  const weekday = intField(body.weekday, 'weekday');
  const startTime = requiredText(body.startTime ?? body.start_time, 'startTime');
  const endTime = requiredText(body.endTime ?? body.end_time, 'endTime');
  const slotMinutes = intField(body.slotMinutes ?? body.slot_minutes, 'slotMinutes');

  const { rows } = await query(
    `SELECT avail_id, doctor_id, weekday,
            to_char(start_time, 'HH24:MI') AS start_time,
            to_char(end_time, 'HH24:MI') AS end_time,
            slot_minutes
     FROM sp_add_availability($1, $2, $3::time, $4::time, $5)`,
    [req.user.id, weekday, startTime, endTime, slotMinutes]
  );
  res.status(201).json({ availability: rows[0] });
}));

router.delete('/doctor/availability/:availId', handle(async (req, res) => {
  const availId = intParam(req.params.availId, 'availId');
  const { rows } = await query(
    'SELECT sp_delete_availability($1, $2) AS deleted',
    [req.user.id, availId]
  );
  if (!rows[0]?.deleted) {
    throw new HttpError(404, 'Availability window not found');
  }
  res.json({ deleted: true, availId });
}));

router.get('/doctor/slots', handle(async (req, res) => {
  const params = [req.user.id];
  let filter = `(slot_start AT TIME ZONE 'Asia/Kolkata')::date >= (now() AT TIME ZONE 'Asia/Kolkata')::date`;

  if (req.query.date !== undefined && req.query.date !== '') {
    params.push(requiredText(req.query.date, 'date'));
    filter = `(slot_start AT TIME ZONE 'Asia/Kolkata')::date = $2::date`;
  }

  const { rows } = await query(
    `SELECT slot_id, doctor_id, slot_start, slot_end, status
     FROM slot
     WHERE doctor_id = $1
       AND ${filter}
     ORDER BY slot_start`,
    params
  );
  res.json({ slots: rows });
}));

router.post('/doctor/slots/generate', handle(async (req, res) => {
  const body = req.body || {};
  const startDate = requiredText(body.startDate ?? body.start_date, 'startDate');
  const endDate = requiredText(body.endDate ?? body.end_date, 'endDate');

  const { rows } = await query(
    'SELECT sp_generate_slots($1, $2::date, $3::date) AS created',
    [req.user.id, startDate, endDate]
  );
  res.json({ created: rows[0].created });
}));

router.patch('/doctor/slots/:slotId/block', handle(async (req, res) => {
  const slotId = intParam(req.params.slotId, 'slotId');
  const block = req.body?.block;
  if (typeof block !== 'boolean') {
    throw new HttpError(400, 'block must be true or false');
  }

  const { rows } = await query(
    `SELECT slot_id, doctor_id, slot_start, slot_end, status
     FROM sp_toggle_slot_block($1, $2, $3)`,
    [req.user.id, slotId, block]
  );
  res.json({ slot: rows[0] });
}));

router.get('/doctor/appointments', handle(async (req, res) => {
  const view = req.query.view ? String(req.query.view) : 'today';
  if (!VIEWS.has(view)) {
    throw new HttpError(400, 'view must be today, upcoming, past, or all');
  }

  const params = [req.user.id];
  const where = ['doctor_id = $1'];

  if (req.query.date !== undefined && req.query.date !== '') {
    params.push(requiredText(req.query.date, 'date'));
    where.push(`visit_date = $${params.length}::date`);
  } else if (view === 'today') {
    where.push(`visit_date = (now() AT TIME ZONE 'Asia/Kolkata')::date`);
  } else if (view === 'upcoming') {
    where.push(`visit_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date`);
  } else if (view === 'past') {
    where.push(`visit_date < (now() AT TIME ZONE 'Asia/Kolkata')::date`);
  }

  if (req.query.status !== undefined && req.query.status !== '') {
    params.push(requiredText(req.query.status, 'status').toUpperCase());
    where.push(`status = $${params.length}`);
  }

  const order = view === 'past' ? 'slot_start DESC' : 'slot_start ASC';
  const { rows } = await query(
    `SELECT appt_id, status, reason, booked_at, cancelled_at, slot_id, doctor_id,
            slot_start, slot_end, visit_date, patient_id, patient_name,
            patient_phone, patient_dob, patient_gender, has_prescription
     FROM v_doctor_appointments
     WHERE ${where.join(' AND ')}
     ORDER BY ${order}`,
    params
  );
  res.json({ appointments: rows });
}));

router.patch('/doctor/appointments/:apptId/status', handle(async (req, res) => {
  const apptId = intParam(req.params.apptId, 'apptId');
  const status = requiredText(req.body?.status, 'status').toUpperCase();

  const { rows } = await query(
    `SELECT appt_id, slot_id, patient_id, status, reason, booked_at, cancelled_at
     FROM sp_set_appointment_status($1, $2, $3)`,
    [req.user.id, apptId, status]
  );
  res.json({ appointment: rows[0] });
}));

module.exports = router;
