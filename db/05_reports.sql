-- ============================================================================
-- MediSlot: Doctor Appointment Booking System
-- Group 6 | Priyadarshini Ghosh(2024A8PS0479H)
-- File: db/05_reports.sql
-- Description: views for analytics:
--              1. v_doctor_utilisation - Total slots, booked count, & utilisation %
--              2. v_specialty_demand  - Total appointments & revenue by specialty
--              3. v_clinic_revenue    - Total gross revenue & net revenue by clinic
-- ============================================================================
-- Clean slate drop for views
DROP VIEW IF EXISTS v_doctor_utilisation CASCADE;
DROP VIEW IF EXISTS v_specialty_demand CASCADE;
DROP VIEW IF EXISTS v_clinic_revenue CASCADE;

-- ----------------------------------------------------------------------------
-- 1. v_doctor_utilisation
-- This view calculates total slots generated, booked count (including completed), and 
-- overall slot utilisation percentage for every doctor.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_doctor_utilisation AS
SELECT 
    d.doctor_id,
    u.full_name AS doctor_name,
    s.name AS specialty_name,
    c.name AS clinic_name,
    c.city,
    COUNT(sl.slot_id)::INT AS total_slots,
    COUNT(CASE WHEN sl.status = 'BOOKED' THEN 1 END)::INT AS booked_slots,
    COUNT(CASE WHEN a.status = 'COMPLETED' THEN 1 END)::INT AS completed_appointments,
    COUNT(CASE WHEN a.status = 'NO_SHOW' THEN 1 END)::INT AS no_show_appointments,
    COUNT(CASE WHEN a.status = 'CANCELLED' THEN 1 END)::INT AS cancelled_appointments,
    ROUND(
        COALESCE(
            (COUNT(CASE WHEN sl.status = 'BOOKED' OR a.status = 'COMPLETED' THEN 1 END)::NUMERIC / 
             NULLIF(COUNT(sl.slot_id), 0)) * 100.0, 
            0.00
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

-- ----------------------------------------------------------------------------
-- 2. v_specialty_demand
-- This view tracks overall demand by counting total appointments, completed visits, 
-- unique patients, and total revenue generated per medical specialty.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_specialty_demand AS
SELECT
    sp.specialty_id,
    sp.name AS specialty_name,
    COUNT(DISTINCT d.doctor_id)::INT AS active_doctors_count,
    COUNT(a.appt_id)::INT AS total_appointments,
    COUNT(CASE WHEN a.status = 'COMPLETED' THEN 1 END)::INT AS completed_appointments,
    COUNT(DISTINCT a.patient_id)::INT AS unique_patients_served,
    COALESCE(SUM(p.amount - p.refund_amount), 0.00) AS net_revenue
FROM specialty sp
LEFT JOIN doctor d ON sp.specialty_id = d.specialty_id
LEFT JOIN slot sl ON d.doctor_id = sl.doctor_id
LEFT JOIN appointment a ON sl.slot_id = a.slot_id
LEFT JOIN payment p ON a.appt_id = p.appt_id
GROUP BY sp.specialty_id, sp.name;

-- ----------------------------------------------------------------------------
-- 3. v_clinic_revenue
-- Summarizes financial performance per clinic across total transactions,
-- gross payments collected, total refunds issued, and net revenue.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_clinic_revenue AS
SELECT 
    c.clinic_id,
    c.name AS clinic_name,
    c.city,
    COUNT(p.payment_id)::INT AS total_payments_processed,
    COALESCE(SUM(p.amount), 0.00) AS gross_revenue,
    COALESCE(SUM(p.refund_amount), 0.00) AS total_refunded,
    COALESCE(SUM(p.amount - p.refund_amount), 0.00) AS net_revenue
FROM clinic c
LEFT JOIN doctor d ON c.clinic_id = d.clinic_id
LEFT JOIN slot sl ON d.doctor_id = sl.doctor_id
LEFT JOIN appointment a ON sl.slot_id = a.slot_id
LEFT JOIN payment p ON a.appt_id = p.appt_id
GROUP BY c.clinic_id, c.name, c.city;