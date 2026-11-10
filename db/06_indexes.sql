-- ============================================================================
-- MediSlot: Doctor Appointment Booking System
-- Group 6 | Data & Performance
-- File: db/06_indexes.sql
-- Description: Five workload-oriented indexes for doctor search, free-slot
--              lookup, patient appointment history and analytics joins.
--
-- Run AFTER 01_tables.sql through 05_reports.sql.
-- Validate with EXPLAIN (ANALYZE, BUFFERS) using representative data.
-- ============================================================================

-- 1. Search clinics by city; supports city-filtered doctor discovery.
CREATE INDEX IF NOT EXISTS idx_clinic_city
    ON clinic (city, clinic_id);

-- 2. Filter doctors by specialty and clinic during doctor search.
-- clinic_id is included after specialty_id to support combined filters.
CREATE INDEX IF NOT EXISTS idx_doctor_specialty_clinic
    ON doctor (specialty_id, clinic_id, doctor_id);

-- 3. Find the next free slots for a doctor without scanning booked/blocked slots.
-- Supports Q7: next free slots per doctor ordered by slot_start.
CREATE INDEX IF NOT EXISTS idx_slot_free_doctor_start
    ON slot (doctor_id, slot_start)
    WHERE status = 'FREE';

-- 4. Patient appointment history, ordered by most recently booked.
CREATE INDEX IF NOT EXISTS idx_appointment_patient_booked_at
    ON appointment (patient_id, booked_at DESC)
    INCLUDE (appt_id, slot_id, status);

-- 5. Analytics joins from slots to all appointment states, including cancelled.
-- The existing partial unique index excludes cancelled appointments, so it
-- cannot alone cover reporting that counts cancellation history.
CREATE INDEX IF NOT EXISTS idx_appointment_slot_all
    ON appointment (slot_id)
    INCLUDE (appt_id, patient_id, status);

ANALYZE clinic;
ANALYZE doctor;
ANALYZE slot;
ANALYZE appointment;
ANALYZE payment;
