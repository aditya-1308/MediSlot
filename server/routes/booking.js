// MediSlot | Mohammad Mubeen Khan | server/routes/booking.js
// Booking workflow (W1) and cancellation with refund. Every rule lives in
// db/03_booking.sql; these handlers only call its functions and views.
//
//   GET  /api/booking/slots/:slotId        slot, doctor, clinic and fee (booking page)
//   POST /api/booking                      { slotId, method, reason } -> sp_book_appointment
//   GET  /api/booking/mine?when=upcoming   patient's appointments (upcoming | past | all)
//   GET  /api/booking/:apptId              one of the patient's appointments
//   POST /api/booking/:apptId/cancel       -> sp_cancel_appointment, returns refund

const express = require('express');
const { query } = require('../db');
const { HttpError } = require('../errors');
const { requireRole } = require('../auth/requireRole');

const router = express.Router();

function intParam(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${name} must be a positive whole number`);
  return n;
}

router.get('/booking/slots/:slotId', requireRole(), async (req, res, next) => {
  try {
    const slotId = intParam(req.params.slotId, 'slotId');
    const { rows } = await query('SELECT * FROM v_slot_details WHERE slot_id = $1', [slotId]);
    if (!rows.length) throw new HttpError(404, 'Slot not found');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/booking', requireRole('PATIENT'), async (req, res, next) => {
  try {
    const slotId = intParam(req.body.slotId, 'slotId');
    const { method, reason } = req.body;
    // Payment is simulated: the method is recorded, no gateway is called.
    const { rows } = await query(
      'SELECT sp_book_appointment($1, $2, $3, $4) AS appt_id',
      [req.user.id, slotId, method, reason || null]
    );
    const appt = await query('SELECT * FROM v_patient_appointments WHERE appt_id = $1', [rows[0].appt_id]);
    res.status(201).json(appt.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/booking/mine', requireRole('PATIENT'), async (req, res, next) => {
  try {
    const when = req.query.when || 'upcoming';
    const filters = {
      upcoming: "AND status = 'BOOKED' AND slot_end > now() ORDER BY slot_start",
      past: "AND NOT (status = 'BOOKED' AND slot_end > now()) ORDER BY slot_start DESC",
      all: 'ORDER BY slot_start DESC',
    };
    if (!filters[when]) throw new HttpError(400, 'when must be upcoming, past or all');
    const { rows } = await query(
      `SELECT * FROM v_patient_appointments WHERE patient_id = $1 ${filters[when]}`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/booking/:apptId', requireRole('PATIENT'), async (req, res, next) => {
  try {
    const apptId = intParam(req.params.apptId, 'apptId');
    const { rows } = await query(
      'SELECT * FROM v_patient_appointments WHERE appt_id = $1 AND patient_id = $2',
      [apptId, req.user.id]
    );
    if (!rows.length) throw new HttpError(404, 'Appointment not found');
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/booking/:apptId/cancel', requireRole('PATIENT'), async (req, res, next) => {
  try {
    const apptId = intParam(req.params.apptId, 'apptId');
    const { rows } = await query(
      'SELECT sp_cancel_appointment($1, $2) AS refund',
      [apptId, req.user.id]
    );
    const appt = await query('SELECT * FROM v_patient_appointments WHERE appt_id = $1', [apptId]);
    res.json({ refund: rows[0].refund, appointment: appt.rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
