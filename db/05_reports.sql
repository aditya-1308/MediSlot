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
-- This tracks the overall demand and total doctors per specialty.
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