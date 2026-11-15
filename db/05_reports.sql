-- ============================================================================
-- MediSlot: Doctor Appointment Booking System
-- Group 6 | Priyadarshini Ghosh
-- File: db/05_reports.sql
-- Description: Analytics views
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. v_doctor_utilisation
-- This uses COUNT(DISTINCT ...) with FILTER (WHERE ...) syntax to correctly calculate
-- the slot utilization without overcounting slots with historical cancellations.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_doctor_utilisation AS
SELECT 
    d.doctor_id,
    u.full_name AS doctor_name,
    s.name AS specialty_name,
    c.name AS clinic_name,
    c.city,
    COUNT(DISTINCT sl.slot_id)::INT AS total_slots,
    COUNT(DISTINCT sl.slot_id) FILTER (WHERE sl.status = 'BOOKED')::INT AS booked_slots,
    COUNT(DISTINCT a.appt_id) FILTER (WHERE a.status = 'COMPLETED')::INT AS completed_appointments,
    COUNT(DISTINCT a.appt_id) FILTER (WHERE a.status = 'NO_SHOW')::INT AS no_show_appointments,
    COUNT(DISTINCT a.appt_id) FILTER (WHERE a.status = 'CANCELLED')::INT AS cancelled_appointments,
    ROUND(
        COALESCE(
            COUNT(DISTINCT sl.slot_id) FILTER (WHERE sl.status = 'BOOKED')::NUMERIC 
            / NULLIF(COUNT(DISTINCT sl.slot_id), 0) * 100,
            0
        ),
        2
    ) AS utilisation_percentage
FROM doctor d
JOIN app_user u ON d.doctor_id = u.user_id
JOIN specialty s ON d.specialty_id = s.specialty_id
JOIN clinic c ON d.clinic_id = c.clinic_id
LEFT JOIN slot sl ON d.doctor_id = sl.doctor_id
LEFT JOIN appointment a ON sl.slot_id = a.slot_id
GROUP BY d.doctor_id, u.full_name, s.name, c.name, c.city;


-- 2. v_specialty_demand
-- was missing the create view wrapper
CREATE OR REPLACE VIEW v_specialty_demand AS
SELECT 
    sp.specialty_id,
    sp.name AS specialty_name,
    COUNT(DISTINCT d.doctor_id)::INT AS total_doctors_count,
    COUNT(DISTINCT a.appt_id)::INT AS total_appointments,
    COUNT(DISTINCT a.appt_id) FILTER (WHERE a.status = 'COMPLETED')::INT AS completed_appointments,
    COUNT(DISTINCT a.patient_id)::INT AS unique_patients_served,
    COALESCE(SUM(p.amount - p.refund_amount), 0.00) AS net_revenue
FROM specialty sp
LEFT JOIN doctor d ON sp.specialty_id = d.specialty_id
LEFT JOIN slot sl ON d.doctor_id = sl.doctor_id
LEFT JOIN appointment a ON sl.slot_id = a.slot_id
LEFT JOIN payment p ON a.appt_id = p.appt_id
GROUP BY sp.specialty_id, sp.name;

-- 3. v_clinic_revenue
--This calculates the financial performance metrics per clinic.
CREATE OR REPLACE VIEW v_clinic_revenue AS
SELECT 
    c.clinic_id,
    c.name AS clinic_name,
    c.city,
    COUNT(DISTINCT p.payment_id)::INT AS total_payments_processed,
    COALESCE(SUM(p.amount), 0.00) AS gross_revenue,
    COALESCE(SUM(p.refund_amount), 0.00) AS total_refunded,
    COALESCE(SUM(p.amount - p.refund_amount), 0.00) AS net_revenue
FROM clinic c
LEFT JOIN doctor d ON c.clinic_id = d.clinic_id
LEFT JOIN slot sl ON d.doctor_id = sl.doctor_id
LEFT JOIN appointment a ON sl.slot_id = a.slot_id
LEFT JOIN payment p ON a.appt_id = p.appt_id
GROUP BY c.clinic_id, c.name, c.city;

-- ============================================================================
-- Additional views for patient, doctor, slot and payment workflows
-- ============================================================================

-- 4. Patient appointment history
-- Shows all appointments for each patient, including cancelled visits.
CREATE OR REPLACE VIEW v_patient_appointment_history AS
SELECT
    a.appt_id,
    a.patient_id,
    pu.full_name AS patient_name,
    a.status AS appointment_status,
    a.reason,
    a.booked_at,
    a.cancelled_at,
    sl.slot_id,
    sl.slot_start,
    sl.slot_end,
    d.doctor_id,
    du.full_name AS doctor_name,
    sp.name AS specialty_name,
    c.name AS clinic_name,
    c.city
FROM appointment a
JOIN patient p ON a.patient_id = p.patient_id
JOIN app_user pu ON p.patient_id = pu.user_id
JOIN slot sl ON a.slot_id = sl.slot_id
JOIN doctor d ON sl.doctor_id = d.doctor_id
JOIN app_user du ON d.doctor_id = du.user_id
JOIN specialty sp ON d.specialty_id = sp.specialty_id
JOIN clinic c ON d.clinic_id = c.clinic_id;


-- 5. Doctor upcoming appointments
-- Shows future booked appointments for each doctor.
CREATE OR REPLACE VIEW v_doctor_upcoming_appointments AS
SELECT
    a.appt_id,
    d.doctor_id,
    du.full_name AS doctor_name,
    a.patient_id,
    pu.full_name AS patient_name,
    sl.slot_id,
    sl.slot_start,
    sl.slot_end,
    sp.name AS specialty_name,
    c.name AS clinic_name,
    c.city,
    a.reason
FROM appointment a
JOIN slot sl ON a.slot_id = sl.slot_id
JOIN doctor d ON sl.doctor_id = d.doctor_id
JOIN app_user du ON d.doctor_id = du.user_id
JOIN patient p ON a.patient_id = p.patient_id
JOIN app_user pu ON p.patient_id = pu.user_id
JOIN specialty sp ON d.specialty_id = sp.specialty_id
JOIN clinic c ON d.clinic_id = c.clinic_id
WHERE a.status = 'BOOKED'
  AND sl.slot_start > CURRENT_TIMESTAMP;


-- 6. Available future slots
-- Shows free slots along with doctor, specialty and clinic information.
CREATE OR REPLACE VIEW v_available_slots AS
SELECT
    sl.slot_id,
    sl.slot_start,
    sl.slot_end,
    d.doctor_id,
    du.full_name AS doctor_name,
    d.fee,
    sp.name AS specialty_name,
    c.clinic_id,
    c.name AS clinic_name,
    c.city
FROM slot sl
JOIN doctor d ON sl.doctor_id = d.doctor_id
JOIN app_user du ON d.doctor_id = du.user_id
JOIN specialty sp ON d.specialty_id = sp.specialty_id
JOIN clinic c ON d.clinic_id = c.clinic_id
WHERE sl.status = 'FREE'
  AND sl.slot_start > CURRENT_TIMESTAMP;


-- 7. Payment summary
-- Shows payment, refund and net amount for each appointment.
CREATE OR REPLACE VIEW v_payment_summary AS
SELECT
    p.payment_id,
    p.appt_id,
    a.patient_id,
    pu.full_name AS patient_name,
    d.doctor_id,
    du.full_name AS doctor_name,
    p.amount AS gross_amount,
    p.refund_amount,
    (p.amount - p.refund_amount) AS net_amount,
    p.method,
    p.status AS payment_status,
    p.paid_at,
    a.status AS appointment_status
FROM payment p
JOIN appointment a ON p.appt_id = a.appt_id
JOIN patient pt ON a.patient_id = pt.patient_id
JOIN app_user pu ON pt.patient_id = pu.user_id
JOIN slot sl ON a.slot_id = sl.slot_id
JOIN doctor d ON sl.doctor_id = d.doctor_id
JOIN app_user du ON d.doctor_id = du.user_id;

