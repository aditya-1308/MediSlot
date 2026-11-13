// MediSlot | server/routes/admin.js
// Admin-only management and reporting endpoints. Mounted at /api/admin.
//
//   GET  /api/admin/stats
//   GET/POST/DELETE /api/admin/specialties[/:id]
//   GET/POST/DELETE /api/admin/medicines[/:id]
//   GET  /api/admin/clinics
//   GET  /api/admin/reports/utilisation
//   GET  /api/admin/reports/demand
//   GET  /api/admin/reports/revenue
//   GET  /api/admin/reports/queries?q=1..7

const express = require('express');
const { query } = require('../db');
const { HttpError } = require('../errors');
const { requireRole } = require('../auth/requireRole');

const router = express.Router();
router.use(requireRole('ADMIN'));

function intParam(value, name) {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${name} must be a positive whole number`);
  return n;
}

router.get('/stats', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT
        (SELECT COUNT(*) FROM clinic)::INT AS clinics,
        (SELECT COUNT(*) FROM doctor)::INT AS doctors,
        (SELECT COUNT(*) FROM patient)::INT AS patients,
        (SELECT COUNT(*) FROM specialty)::INT AS specialties,
        (SELECT COUNT(*) FROM medicine)::INT AS medicines,
        (SELECT COUNT(*) FROM appointment WHERE status = 'BOOKED')::INT AS "activeBookings",
        COALESCE(
          (SELECT SUM(d.fee) FROM appointment a JOIN slot s ON a.slot_id = s.slot_id JOIN doctor d ON s.doctor_id = d.doctor_id WHERE a.status = 'COMPLETED'),
          0
        ) AS "netRevenue"
    `);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.get('/specialties', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT specialty_id, name FROM specialty ORDER BY name');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.post('/specialties', async (req, res, next) => {
  try {
    const name = (req.body.name || '').trim();
    if (!name) throw new HttpError(400, 'name is required');
    const { rows } = await query(
      'INSERT INTO specialty(name) VALUES($1) RETURNING *',
      [name]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/specialties/:id', async (req, res, next) => {
  try {
    const id = intParam(req.params.id, 'id');
    await query('DELETE FROM specialty WHERE specialty_id = $1', [id]);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

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

router.post('/medicines', async (req, res, next) => {
  try {
    const { name, form, strength } = req.body;
    if (!name || !form) throw new HttpError(400, 'name and form are required');
    const { rows } = await query(
      'INSERT INTO medicine(name, form, strength) VALUES($1, $2, $3) RETURNING *',
      [name, form, strength || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/medicines/:id', async (req, res, next) => {
  try {
    const id = intParam(req.params.id, 'id');
    await query('DELETE FROM medicine WHERE medicine_id = $1', [id]);
    res.json({ deleted: true });
  } catch (err) {
    next(err);
  }
});

router.get('/clinics', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.clinic_id, c.name, c.address, c.city,
              COUNT(d.doctor_id)::INT AS doctor_count
       FROM clinic c
       LEFT JOIN doctor d USING(clinic_id)
       GROUP BY c.clinic_id
       ORDER BY c.city, c.name`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/reports/utilisation', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM v_doctor_utilisation ORDER BY utilisation_percentage DESC'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/reports/demand', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM v_specialty_demand ORDER BY total_appointments DESC'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/reports/revenue', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT * FROM v_clinic_revenue ORDER BY net_revenue DESC'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// inlined analytical queries from db/07_queries.sql and queries/q7_next_free_slots.sql
const QUERIES = {
  1: `
    SELECT
        c.clinic_id,
        c.name AS clinic_name,
        c.city,
        COUNT(DISTINCT sl.slot_id)::INT AS total_slots,
        COUNT(DISTINCT CASE WHEN sl.status = 'BOOKED' THEN sl.slot_id END)::INT AS booked_slots,
        COUNT(DISTINCT a.appt_id) FILTER (WHERE a.status = 'NO_SHOW')::INT AS no_show_count,
        COUNT(DISTINCT a.appt_id)::INT AS total_appointments,
        ROUND(
            COALESCE(
                (COUNT(DISTINCT a.appt_id) FILTER (WHERE a.status = 'NO_SHOW')::NUMERIC /
                 NULLIF(COUNT(DISTINCT a.appt_id), 0)) * 100.0,
                0.00
            ),
            2
        ) AS no_show_rate_percentage
    FROM clinic c
    JOIN doctor d ON c.clinic_id = d.clinic_id
    JOIN slot sl ON d.doctor_id = sl.doctor_id
    LEFT JOIN appointment a ON sl.slot_id = a.slot_id
    GROUP BY c.clinic_id, c.name, c.city
    HAVING COUNT(DISTINCT a.appt_id) > 0
    ORDER BY no_show_rate_percentage DESC
  `,
  2: `
    WITH ranked_specialties AS (
        SELECT
            c.city,
            sp.name AS specialty_name,
            COUNT(DISTINCT a.appt_id)::INT AS total_appointments,
            RANK() OVER (
                PARTITION BY c.city
                ORDER BY COUNT(DISTINCT a.appt_id) DESC
            ) AS rnk
        FROM clinic c
        JOIN doctor d ON c.clinic_id = d.clinic_id
        JOIN specialty sp ON d.specialty_id = sp.specialty_id
        JOIN slot sl ON d.doctor_id = sl.doctor_id
        JOIN appointment a ON sl.slot_id = a.slot_id
        GROUP BY c.city, sp.name
    )
    SELECT city, specialty_name, total_appointments, rnk
    FROM ranked_specialties
    WHERE rnk <= 3
    ORDER BY city, rnk
  `,
  3: `
    WITH doctor_completed AS (
        SELECT
            d.doctor_id,
            u.full_name AS doctor_name,
            d.specialty_id,
            sp.name AS specialty_name,
            COUNT(DISTINCT a.appt_id) FILTER (WHERE a.status = 'COMPLETED')::INT AS completed_count
        FROM doctor d
        JOIN app_user u ON d.doctor_id = u.user_id
        JOIN specialty sp ON d.specialty_id = sp.specialty_id
        LEFT JOIN slot sl ON d.doctor_id = sl.doctor_id
        LEFT JOIN appointment a ON sl.slot_id = a.slot_id
        GROUP BY d.doctor_id, u.full_name, d.specialty_id, sp.name
    ),
    specialty_avg AS (
        SELECT
            specialty_id,
            AVG(completed_count) AS avg_completed
        FROM doctor_completed
        GROUP BY specialty_id
    )
    SELECT
        dc.doctor_id,
        dc.doctor_name,
        dc.specialty_name,
        dc.completed_count,
        ROUND(sa.avg_completed, 2) AS specialty_avg_completed
    FROM doctor_completed dc
    JOIN specialty_avg sa ON dc.specialty_id = sa.specialty_id
    WHERE dc.completed_count > sa.avg_completed
    ORDER BY dc.specialty_name, dc.completed_count DESC
  `,
  4: `
    SELECT
        p.patient_id,
        u.full_name AS patient_name,
        u.email,
        COUNT(DISTINCT a.appt_id)::INT AS total_bookings,
        COUNT(DISTINCT d.clinic_id)::INT AS clinics_visited
    FROM patient p
    JOIN app_user u ON p.patient_id = u.user_id
    JOIN appointment a ON p.patient_id = a.patient_id
    JOIN slot sl ON a.slot_id = sl.slot_id
    JOIN doctor d ON sl.doctor_id = d.doctor_id
    GROUP BY p.patient_id, u.full_name, u.email
    HAVING COUNT(DISTINCT a.appt_id) > 1
    ORDER BY total_bookings DESC
  `,
  5: `
    SELECT
        sp.name AS specialty_name,
        m.name AS medicine_name,
        m.form AS dosage_form,
        SUM(pi.days_supply)::INT AS total_days_supplied,
        COUNT(DISTINCT pi.appt_id)::INT AS prescription_count
    FROM specialty sp
    JOIN doctor d ON sp.specialty_id = d.specialty_id
    JOIN slot sl ON d.doctor_id = sl.doctor_id
    JOIN appointment a ON sl.slot_id = a.slot_id
    JOIN prescription_item pi ON a.appt_id = pi.appt_id
    JOIN medicine m ON pi.medicine_id = m.medicine_id
    GROUP BY sp.name, m.name, m.form
    ORDER BY sp.name, prescription_count DESC, total_days_supplied DESC
  `,
  6: `
    SELECT
        TO_CHAR(p.paid_at, 'YYYY-MM') AS revenue_month,
        c.name AS clinic_name,
        COUNT(DISTINCT p.payment_id)::INT AS total_transactions,
        COALESCE(SUM(p.amount), 0.00) AS gross_revenue,
        COALESCE(SUM(p.refund_amount), 0.00) AS total_refunded,
        COALESCE(SUM(p.amount - p.refund_amount), 0.00) AS net_revenue
    FROM payment p
    JOIN appointment a ON p.appt_id = a.appt_id
    JOIN slot sl ON a.slot_id = sl.slot_id
    JOIN doctor d ON sl.doctor_id = d.doctor_id
    JOIN clinic c ON d.clinic_id = c.clinic_id
    WHERE p.status IN ('PAID', 'PARTIAL_REFUND', 'REFUNDED')
    GROUP BY TO_CHAR(p.paid_at, 'YYYY-MM'), c.name
    ORDER BY revenue_month DESC, net_revenue DESC
  `,
  7: `
    WITH ranked_slots AS (
        SELECT
            d.doctor_id,
            u.full_name AS doctor_name,
            sp.name AS specialty_name,
            c.name AS clinic_name,
            c.city,
            sl.slot_id,
            sl.slot_start,
            sl.slot_end,
            ROW_NUMBER() OVER (
                PARTITION BY d.doctor_id
                ORDER BY sl.slot_start ASC
            ) AS slot_rank
        FROM doctor d
        JOIN app_user u ON u.user_id = d.doctor_id
        JOIN specialty sp ON sp.specialty_id = d.specialty_id
        JOIN clinic c ON c.clinic_id = d.clinic_id
        JOIN slot sl ON sl.doctor_id = d.doctor_id
        WHERE c.city = 'Hyderabad'
          AND sl.status = 'FREE'
          AND sl.slot_start > NOW()
    )
    SELECT doctor_id, doctor_name, specialty_name, clinic_name, city,
           slot_id, slot_start, slot_end
    FROM ranked_slots
    WHERE slot_rank <= 3
    ORDER BY doctor_id, slot_start
  `,
};

router.get('/reports/queries', async (req, res, next) => {
  try {
    const q = Number(req.query.q);
    if (!Number.isInteger(q) || q < 1 || q > 7) {
      throw new HttpError(400, 'q must be an integer between 1 and 7');
    }
    const { rows } = await query(QUERIES[q]);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
