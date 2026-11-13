// MediSlot | Suryanath A | server/routes/clinical.js
// Prescription and review endpoints. Mounted at /api/clinical.
//
//   GET  /api/clinical/medicines                    public — medicine catalogue
//   GET  /api/clinical/visits/:apptId/prescription  any auth — view prescription
//   POST /api/clinical/visits/:apptId/prescription  DOCTOR — add item
//   DEL  /api/clinical/visits/:apptId/prescription/:medicineId  DOCTOR — remove item
//   POST /api/clinical/visits/:apptId/review        PATIENT — submit review

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

// public
router.get('/medicines', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT medicine_id, name, form, strength FROM medicine ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/visits/:apptId/prescription', requireRole(), async (req, res, next) => {
  try {
    const apptId = intParam(req.params.apptId, 'apptId');
    const { role, id } = req.user;

    if (role === 'PATIENT') {
      const { rows: owns } = await query(
        'SELECT 1 FROM appointment WHERE appt_id = $1 AND patient_id = $2',
        [apptId, id]
      );
      if (!owns.length) throw new HttpError(403, 'Not your appointment');
    } else if (role === 'DOCTOR') {
      const { rows: owns } = await query(
        `SELECT 1 FROM appointment a
         JOIN slot s ON a.slot_id = s.slot_id
         WHERE a.appt_id = $1 AND s.doctor_id = $2`,
        [apptId, id]
      );
      if (!owns.length) throw new HttpError(403, 'Not your appointment');
    }
    // ADMIN: allow all

    const { rows } = await query(
      `SELECT pi.medicine_id, m.name, m.form, m.strength, pi.dosage, pi.days_supply
       FROM prescription_item pi
       JOIN medicine m USING(medicine_id)
       WHERE pi.appt_id = $1`,
      [apptId]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/visits/:apptId/prescription', requireRole('DOCTOR'), async (req, res, next) => {
  try {
    const apptId = intParam(req.params.apptId, 'apptId');
    const medicineId = intParam(req.body.medicineId, 'medicineId');
    const { dosage, days_supply } = req.body;

    // make sure this doctor owns the slot
    const { rows: owns } = await query(
      `SELECT 1 FROM appointment a
       JOIN slot s ON a.slot_id = s.slot_id
       WHERE a.appt_id = $1 AND s.doctor_id = $2`,
      [apptId, req.user.id]
    );
    if (!owns.length) throw new HttpError(403, 'Not your appointment');

    // R6 trigger will raise if appointment not COMPLETED
    const { rows } = await query(
      `INSERT INTO prescription_item(appt_id, medicine_id, dosage, days_supply)
       VALUES($1, $2, $3, $4)
       RETURNING *`,
      [apptId, medicineId, dosage || null, days_supply || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/visits/:apptId/prescription/:medicineId', requireRole('DOCTOR'), async (req, res, next) => {
  try {
    const apptId = intParam(req.params.apptId, 'apptId');
    const medicineId = intParam(req.params.medicineId, 'medicineId');

    const { rows: owns } = await query(
      `SELECT 1 FROM appointment a
       JOIN slot s ON a.slot_id = s.slot_id
       WHERE a.appt_id = $1 AND s.doctor_id = $2`,
      [apptId, req.user.id]
    );
    if (!owns.length) throw new HttpError(403, 'Not your appointment');

    await query(
      'DELETE FROM prescription_item WHERE appt_id = $1 AND medicine_id = $2',
      [apptId, medicineId]
    );
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

router.post('/visits/:apptId/review', requireRole('PATIENT'), async (req, res, next) => {
  try {
    const apptId = intParam(req.params.apptId, 'apptId');
    const { rating, comment } = req.body;

    const { rows: owns } = await query(
      'SELECT 1 FROM appointment WHERE appt_id = $1 AND patient_id = $2',
      [apptId, req.user.id]
    );
    if (!owns.length) throw new HttpError(403, 'Not your appointment');

    // R6 trigger handles COMPLETED check
    const { rows } = await query(
      `INSERT INTO review(appt_id, rating, comment) VALUES($1, $2, $3) RETURNING *`,
      [apptId, rating, comment || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
