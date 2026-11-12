-- ============================================================================
-- MediSlot: Doctor Appointment Booking System
-- Group 6 | Priyadarshini Ghosh
-- File: db/06_queries.sql
-- Description:Analytical Queries (q1 to q6)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- q1: Utilisation and No-Show Rate per Clinic (GROUP BY, HAVING)
-- This query calculates slot utilization and patient no-show percentage for clinics with 
-- at least 1 total appointment scheduled.
-- ----------------------------------------------------------------------------
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
ORDER BY no_show_rate_percentage DESC;

-- ----------------------------------------------------------------------------
-- q2: Top Specialties per City (RANK)
-- This query ranks specialties within each city by total appointment demand.
-- ----------------------------------------------------------------------------
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
ORDER BY city, rnk;

-- ----------------------------------------------------------------------------
-- q3: Doctors Above Their Specialty Average (CTE plus subquery)
-- This query finds doctors whose completed appointment count exceeds the average for their specialty.
-- ----------------------------------------------------------------------------
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
ORDER BY dc.specialty_name, dc.completed_count DESC;

-- ----------------------------------------------------------------------------
-- q4: Repeat Patients
-- This query identifies patients who have booked more than 1 appointment across any clinic.
-- ----------------------------------------------------------------------------
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
ORDER BY total_bookings DESC;

-- ----------------------------------------------------------------------------
-- q5: Most Prescribed Medicines per Specialty (4-table join)
-- This query joins specialty, appointment, prescription_item, and medicine to rank top prescribed drugs.
-- ----------------------------------------------------------------------------
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
ORDER BY sp.name, prescription_count DESC, total_days_supplied DESC;

-- ----------------------------------------------------------------------------
-- q6: Monthly Revenue Trend
-- This query breaks down monthly total, net revenue, and refunds across clinics.
-- ----------------------------------------------------------------------------
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
ORDER BY revenue_month DESC, net_revenue DESC;