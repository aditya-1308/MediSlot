-- ============================================================================
-- MediSlot: Doctor Appointment Booking System
-- Group 6 | Aditya Singh (2024A8PS0491H)
-- File: db/tests/test_schedule.sql
-- Description: Unit test suite for Rules R2, R4, R5, R8 and sp_generate_slots.
--              Contains comprehensive PASS (positive) and FAIL (negative constraint)
--              test cases verifying database-level enforcement.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
    v_clinic_id   INT;
    v_spec_id     INT;
    v_doc1_uid    INT;
    v_doc2_uid    INT;
    v_pat1_uid    INT;
    v_pat2_uid    INT;
    v_adm_uid     INT;
    v_slot1_id    INT;
    v_slot2_id    INT;
    v_slot3_id    INT;
    v_slot4_id    INT;
    v_slot5_id    INT;
    v_appt1_id    INT;
    v_appt2_id    INT;
    v_appt3_id    INT;
    v_appt4_id    INT;
    v_slots_gen   INT;
    v_avail_row   availability%ROWTYPE;
    v_appt_row    appointment%ROWTYPE;
    v_slot_row    slot%ROWTYPE;
    v_view_cnt    INT;
    v_test_failed BOOLEAN;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'Running MediSlot Schedule & Schema Test Suite (Group 6 - Aditya Singh)';
    RAISE NOTICE '======================================================================';

    -- ------------------------------------------------------------------------
    -- FIXTURES SETUP
    -- ------------------------------------------------------------------------
    INSERT INTO clinic (name, address, city)
    VALUES ('BITS Wellness Centre', 'Vidyavihar Campus', 'Pilani')
    RETURNING clinic_id INTO v_clinic_id;

    INSERT INTO specialty (name)
    VALUES ('General Medicine')
    RETURNING specialty_id INTO v_spec_id;

    -- Doctors
    INSERT INTO app_user (full_name, email, phone, password_hash, role)
    VALUES ('Dr. Aditya Singh', 'aditya.singh@medislot.com', '9876543210', 'hash_pw1', 'DOCTOR')
    RETURNING user_id INTO v_doc1_uid;

    INSERT INTO app_user (full_name, email, phone, password_hash, role)
    VALUES ('Dr. Neha Sharma', 'neha.sharma@medislot.com', '9876543211', 'hash_pw2', 'DOCTOR')
    RETURNING user_id INTO v_doc2_uid;

    -- Patients
    INSERT INTO app_user (full_name, email, phone, password_hash, role)
    VALUES ('Rohan Verma', 'rohan.verma@medislot.com', '9876543212', 'hash_pw3', 'PATIENT')
    RETURNING user_id INTO v_pat1_uid;

    INSERT INTO app_user (full_name, email, phone, password_hash, role)
    VALUES ('Pooja Nair', 'pooja.nair@medislot.com', '9876543213', 'hash_pw4', 'PATIENT')
    RETURNING user_id INTO v_pat2_uid;

    -- Admin
    INSERT INTO app_user (full_name, email, phone, password_hash, role)
    VALUES ('System Admin', 'admin@medislot.com', '9876543214', 'hash_pw5', 'ADMIN')
    RETURNING user_id INTO v_adm_uid;

    -- ========================================================================
    -- TEST GROUP 1: Rule R8 (Role-based Subtype Integrity: (id, role) FK)
    -- ========================================================================
    RAISE NOTICE '[GROUP 1] Rule R8: Role-based Subtype Integrity';

    -- T1.1: PASS - Doctor references DOCTOR account
    INSERT INTO doctor (doctor_id, role, clinic_id, specialty_id, license_no, fee, experience_yrs)
    VALUES (v_doc1_uid, 'DOCTOR', v_clinic_id, v_spec_id, 'LIC-R8-001', 500.00, 10);
    INSERT INTO doctor (doctor_id, role, clinic_id, specialty_id, license_no, fee, experience_yrs)
    VALUES (v_doc2_uid, 'DOCTOR', v_clinic_id, v_spec_id, 'LIC-R8-002', 750.00, 15);
    RAISE NOTICE '  [PASS] T1.1: Doctor accounts created successfully with DOCTOR role';

    -- T1.2: PASS - Patient references PATIENT account
    INSERT INTO patient (patient_id, role, dob, gender)
    VALUES (v_pat1_uid, 'PATIENT', DATE '1998-04-12', 'M');
    INSERT INTO patient (patient_id, role, dob, gender)
    VALUES (v_pat2_uid, 'PATIENT', DATE '2001-09-25', 'F');
    RAISE NOTICE '  [PASS] T1.2: Patient accounts created successfully with PATIENT role';

    -- T1.3: FAIL - Reject doctor referencing PATIENT account
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO doctor (doctor_id, role, clinic_id, specialty_id, license_no, fee, experience_yrs)
        VALUES (v_pat1_uid, 'DOCTOR', v_clinic_id, v_spec_id, 'LIC-BAD-1', 400.00, 5);
    EXCEPTION
        WHEN foreign_key_violation THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: R8 allowed patient account as doctor';
    END IF;
    RAISE NOTICE '  [PASS] T1.3: Correctly blocked doctor referencing PATIENT account (FK violation)';

    -- T1.4: FAIL - Reject patient referencing DOCTOR account
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO patient (patient_id, role, dob, gender)
        VALUES (v_doc1_uid, 'PATIENT', DATE '1985-01-01', 'M');
    EXCEPTION
        WHEN foreign_key_violation THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: R8 allowed doctor account as patient';
    END IF;
    RAISE NOTICE '  [PASS] T1.4: Correctly blocked patient referencing DOCTOR account (FK violation)';

    -- T1.5: FAIL - Reject ADMIN account as Doctor
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO doctor (doctor_id, role, clinic_id, specialty_id, license_no, fee, experience_yrs)
        VALUES (v_adm_uid, 'DOCTOR', v_clinic_id, v_spec_id, 'LIC-BAD-2', 500.00, 5);
    EXCEPTION
        WHEN foreign_key_violation THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: R8 allowed admin account as doctor';
    END IF;
    RAISE NOTICE '  [PASS] T1.5: Correctly blocked ADMIN account as doctor (FK violation)';

    -- T1.6: FAIL - Reject ADMIN account as Patient
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO patient (patient_id, role, dob, gender)
        VALUES (v_adm_uid, 'PATIENT', DATE '1990-01-01', 'O');
    EXCEPTION
        WHEN foreign_key_violation THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: R8 allowed admin account as patient';
    END IF;
    RAISE NOTICE '  [PASS] T1.6: Correctly blocked ADMIN account as patient (FK violation)';

    -- ========================================================================
    -- TEST GROUP 2: Rule R2 (Slot Overlap GiST Exclusion Constraint)
    -- ========================================================================
    RAISE NOTICE '[GROUP 2] Rule R2: Doctor Slot Overlap Exclusion Constraint';

    -- T2.1: PASS - Contiguous adjacent slots for Doctor 1 (10:00-10:30, 10:30-11:00)
    INSERT INTO slot (doctor_id, slot_start, slot_end, status)
    VALUES (v_doc1_uid, '2026-11-16 10:00:00+05:30', '2026-11-16 10:30:00+05:30', 'FREE')
    RETURNING slot_id INTO v_slot1_id;

    INSERT INTO slot (doctor_id, slot_start, slot_end, status)
    VALUES (v_doc1_uid, '2026-11-16 10:30:00+05:30', '2026-11-16 11:00:00+05:30', 'FREE')
    RETURNING slot_id INTO v_slot2_id;
    RAISE NOTICE '  [PASS] T2.1: Adjacent non-overlapping slots permitted for Doctor 1';

    -- T2.2: PASS - Different doctor allowed identical time slot
    INSERT INTO slot (doctor_id, slot_start, slot_end, status)
    VALUES (v_doc2_uid, '2026-11-16 10:00:00+05:30', '2026-11-16 10:30:00+05:30', 'FREE')
    RETURNING slot_id INTO v_slot3_id;
    RAISE NOTICE '  [PASS] T2.2: Different doctor permitted identical time slot';

    -- T2.3: FAIL - Overlapping slot start (10:15 - 10:45 overlaps with 10:00-10:30 and 10:30-11:00)
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO slot (doctor_id, slot_start, slot_end, status)
        VALUES (v_doc1_uid, '2026-11-16 10:15:00+05:30', '2026-11-16 10:45:00+05:30', 'FREE');
    EXCEPTION
        WHEN exclusion_violation THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: R2 allowed overlapping slot';
    END IF;
    RAISE NOTICE '  [PASS] T2.3: Blocked overlapping slot (exclusion_violation)';

    -- T2.4: FAIL - Strictly enclosed slot (10:05 - 10:25 inside 10:00-10:30)
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO slot (doctor_id, slot_start, slot_end, status)
        VALUES (v_doc1_uid, '2026-11-16 10:05:00+05:30', '2026-11-16 10:25:00+05:30', 'FREE');
    EXCEPTION
        WHEN exclusion_violation THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: R2 allowed enclosed slot';
    END IF;
    RAISE NOTICE '  [PASS] T2.4: Blocked strictly enclosed slot (exclusion_violation)';

    -- T2.5: FAIL - Completely encompassing slot (09:50 - 10:40 enclosing 10:00-10:30)
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO slot (doctor_id, slot_start, slot_end, status)
        VALUES (v_doc1_uid, '2026-11-16 09:50:00+05:30', '2026-11-16 10:40:00+05:30', 'FREE');
    EXCEPTION
        WHEN exclusion_violation THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: R2 allowed encompassing slot';
    END IF;
    RAISE NOTICE '  [PASS] T2.5: Blocked encompassing slot (exclusion_violation)';

    -- T2.6: FAIL - Inverted slot (slot_end <= slot_start)
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO slot (doctor_id, slot_start, slot_end, status)
        VALUES (v_doc1_uid, '2026-11-16 12:00:00+05:30', '2026-11-16 11:30:00+05:30', 'FREE');
    EXCEPTION
        WHEN check_violation THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: Allowed slot with end before start';
    END IF;
    RAISE NOTICE '  [PASS] T2.6: Blocked inverted slot time order (check_violation)';

    -- ========================================================================
    -- TEST GROUP 3: Rule R4 (Availability Overlap & Divisibility Trigger)
    -- ========================================================================
    RAISE NOTICE '[GROUP 3] Rule R4: Availability Overlap and Divisibility';

    -- T3.1: PASS - Clean 3-hour window on Monday (09:00-12:00, 30m slots -> 6 slots)
    INSERT INTO availability (doctor_id, weekday, start_time, end_time, slot_minutes)
    VALUES (v_doc1_uid, 1, TIME '09:00:00', TIME '12:00:00', 30);
    RAISE NOTICE '  [PASS] T3.1: Inserted valid divisible availability window';

    -- T3.2: PASS - Abutting boundary window on Monday (12:00-15:00, 30m slots)
    INSERT INTO availability (doctor_id, weekday, start_time, end_time, slot_minutes)
    VALUES (v_doc1_uid, 1, TIME '12:00:00', TIME '15:00:00', 30);
    RAISE NOTICE '  [PASS] T3.2: Abutting boundary availability window permitted (no overlap)';

    -- T3.3: PASS - Identical time window on different weekday (Tuesday 09:00-12:00)
    INSERT INTO availability (doctor_id, weekday, start_time, end_time, slot_minutes)
    VALUES (v_doc1_uid, 2, TIME '09:00:00', TIME '12:00:00', 30);
    RAISE NOTICE '  [PASS] T3.3: Same time on different weekday permitted';

    -- T3.4: FAIL - Indivisible slot window (09:00 to 12:00 with 25m slots -> 180 % 25 = 5 != 0)
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO availability (doctor_id, weekday, start_time, end_time, slot_minutes)
        VALUES (v_doc2_uid, 1, TIME '09:00:00', TIME '12:00:00', 25);
    EXCEPTION
        WHEN others THEN
            IF SQLERRM LIKE '%R4:%' OR SQLERRM LIKE '%chk_avail_slot_minutes%' OR SQLERRM LIKE '%chk_avail_window_divisible%' THEN
                v_test_failed := TRUE;
            END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: Allowed indivisible availability window';
    END IF;
    RAISE NOTICE '  [PASS] T3.4: Blocked indivisible availability window (R4 exception)';

    -- T3.5: FAIL - Overlapping availability window (Monday 10:00-13:00 overlaps 09:00-12:00)
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO availability (doctor_id, weekday, start_time, end_time, slot_minutes)
        VALUES (v_doc1_uid, 1, TIME '10:00:00', TIME '13:00:00', 30);
    EXCEPTION
        WHEN others THEN
            IF SQLERRM LIKE '%R4:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: Allowed overlapping availability window';
    END IF;
    RAISE NOTICE '  [PASS] T3.5: Blocked overlapping availability window (R4 exception)';

    -- T3.6: FAIL - Enclosed availability window (Monday 09:30-11:30 inside 09:00-12:00)
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO availability (doctor_id, weekday, start_time, end_time, slot_minutes)
        VALUES (v_doc1_uid, 1, TIME '09:30:00', TIME '11:30:00', 30);
    EXCEPTION
        WHEN others THEN
            IF SQLERRM LIKE '%R4:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: Allowed enclosed availability window';
    END IF;
    RAISE NOTICE '  [PASS] T3.6: Blocked enclosed availability window (R4 exception)';

    -- T3.7: FAIL - Valid slot_minutes (30) with indivisible window length (09:00-09:40 -> 40m % 30m != 0)
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO availability (doctor_id, weekday, start_time, end_time, slot_minutes)
        VALUES (v_doc2_uid, 2, TIME '09:00:00', TIME '09:40:00', 30);
    EXCEPTION
        WHEN others THEN
            IF SQLERRM LIKE '%R4:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: Allowed indivisible 40-min window with 30-min slots';
    END IF;
    RAISE NOTICE '  [PASS] T3.7: Blocked indivisible 40-minute window with 30-minute slots (R4)';

    -- ========================================================================
    -- TEST GROUP 4: Rule R5 (Appointment Status Lifecycle & Transitions)
    -- ========================================================================
    RAISE NOTICE '[GROUP 4] Rule R5: Appointment Status Lifecycle';

    -- Extra slots for lifecycle testing
    INSERT INTO slot (doctor_id, slot_start, slot_end, status)
    VALUES (v_doc1_uid, '2026-11-16 11:00:00+05:30', '2026-11-16 11:30:00+05:30', 'FREE')
    RETURNING slot_id INTO v_slot4_id;

    INSERT INTO slot (doctor_id, slot_start, slot_end, status)
    VALUES (v_doc1_uid, '2026-11-16 11:30:00+05:30', '2026-11-16 12:00:00+05:30', 'FREE')
    RETURNING slot_id INTO v_slot5_id;

    -- T4.1: PASS - New appointment created in BOOKED state
    INSERT INTO appointment (patient_id, slot_id, status, reason)
    VALUES (v_pat1_uid, v_slot1_id, 'BOOKED', 'Chest discomfort evaluation')
    RETURNING appt_id INTO v_appt1_id;
    RAISE NOTICE '  [PASS] T4.1: Created appointment in BOOKED state';

    -- T4.2: PASS - Transition BOOKED -> COMPLETED
    UPDATE appointment SET status = 'COMPLETED' WHERE appt_id = v_appt1_id;
    RAISE NOTICE '  [PASS] T4.2: Permitted transition BOOKED -> COMPLETED';

    -- T4.3: PASS - Updating non-status field (reason) on COMPLETED appointment
    UPDATE appointment SET reason = 'Chest discomfort evaluation (EKG normal)' WHERE appt_id = v_appt1_id;
    RAISE NOTICE '  [PASS] T4.3: Permitted non-status field update on terminal appointment';

    -- T4.4: FAIL - Terminal transition COMPLETED -> BOOKED
    v_test_failed := FALSE;
    BEGIN
        UPDATE appointment SET status = 'BOOKED' WHERE appt_id = v_appt1_id;
    EXCEPTION
        WHEN others THEN
            IF SQLERRM LIKE '%R5:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: R5 allowed transition out of COMPLETED terminal state';
    END IF;
    RAISE NOTICE '  [PASS] T4.4: Blocked transition COMPLETED -> BOOKED (R5 exception)';

    -- T4.5: FAIL - Terminal transition COMPLETED -> CANCELLED
    v_test_failed := FALSE;
    BEGIN
        UPDATE appointment SET status = 'CANCELLED' WHERE appt_id = v_appt1_id;
    EXCEPTION
        WHEN others THEN
            IF SQLERRM LIKE '%R5:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: R5 allowed transition COMPLETED -> CANCELLED';
    END IF;
    RAISE NOTICE '  [PASS] T4.5: Blocked transition COMPLETED -> CANCELLED (R5 exception)';

    -- T4.6: PASS - Transition BOOKED -> CANCELLED (verifies cancelled_at auto-set)
    INSERT INTO appointment (patient_id, slot_id, status, reason)
    VALUES (v_pat2_uid, v_slot2_id, 'BOOKED', 'Routine consultation')
    RETURNING appt_id INTO v_appt2_id;

    UPDATE appointment SET status = 'CANCELLED' WHERE appt_id = v_appt2_id;
    IF (SELECT cancelled_at FROM appointment WHERE appt_id = v_appt2_id) IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: cancelled_at was not populated on cancellation';
    END IF;
    RAISE NOTICE '  [PASS] T4.6: Permitted BOOKED -> CANCELLED and verified cancelled_at populated';

    -- T4.7: FAIL - Terminal transition CANCELLED -> COMPLETED
    v_test_failed := FALSE;
    BEGIN
        UPDATE appointment SET status = 'COMPLETED' WHERE appt_id = v_appt2_id;
    EXCEPTION
        WHEN others THEN
            IF SQLERRM LIKE '%R5:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: R5 allowed transition CANCELLED -> COMPLETED';
    END IF;
    RAISE NOTICE '  [PASS] T4.7: Blocked transition CANCELLED -> COMPLETED (R5 exception)';

    -- T4.8: PASS - Transition BOOKED -> NO_SHOW
    INSERT INTO appointment (patient_id, slot_id, status, reason)
    VALUES (v_pat1_uid, v_slot4_id, 'BOOKED', 'Follow-up visit')
    RETURNING appt_id INTO v_appt3_id;

    UPDATE appointment SET status = 'NO_SHOW' WHERE appt_id = v_appt3_id;
    RAISE NOTICE '  [PASS] T4.8: Permitted BOOKED -> NO_SHOW';

    -- T4.9: FAIL - Terminal transition NO_SHOW -> CANCELLED
    v_test_failed := FALSE;
    BEGIN
        UPDATE appointment SET status = 'CANCELLED' WHERE appt_id = v_appt3_id;
    EXCEPTION
        WHEN others THEN
            IF SQLERRM LIKE '%R5:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: R5 allowed transition NO_SHOW -> CANCELLED';
    END IF;
    RAISE NOTICE '  [PASS] T4.9: Blocked transition NO_SHOW -> CANCELLED (R5 exception)';

    -- ========================================================================
    -- TEST GROUP 5: Partial Unique Index on appointment(slot_id)
    -- ========================================================================
    RAISE NOTICE '[GROUP 5] Partial Unique Index (Design Decision 1: Slot Re-booking)';

    -- T5.1: PASS - Slot v_slot2_id had appt2 CANCELLED. A new patient books this slot!
    INSERT INTO appointment (patient_id, slot_id, status, reason)
    VALUES (v_pat1_uid, v_slot2_id, 'BOOKED', 'Re-booking previously cancelled slot')
    RETURNING appt_id INTO v_appt4_id;
    RAISE NOTICE '  [PASS] T5.1: Successfully re-booked slot with prior CANCELLED appointment';

    -- T5.2: FAIL - Slot v_slot2_id now has active appointment (v_appt4_id). Second live booking rejected!
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO appointment (patient_id, slot_id, status, reason)
        VALUES (v_pat2_uid, v_slot2_id, 'BOOKED', 'Conflicting booking on same slot');
    EXCEPTION
        WHEN unique_violation THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: Allowed two simultaneous live appointments on same slot';
    END IF;
    RAISE NOTICE '  [PASS] T5.2: Blocked concurrent active appointment on same slot (partial index violation)';

    -- ========================================================================
    -- TEST GROUP 6: Slot Generation Function (sp_generate_slots & sp_generate_all_slots)
    -- ========================================================================
    RAISE NOTICE '[GROUP 6] Slot Generation Engine';

    -- Doctor 1 availability:
    -- Monday: 09:00-12:00 (6 slots) + 12:00-15:00 (6 slots) = 12 slots/Monday
    -- Tuesday: 09:00-12:00 (6 slots) = 6 slots/Tuesday
    -- Total per week = 18 slots.
    -- Date range: 2026-11-23 (Mon) to 2026-11-29 (Sun) = 1 Mon + 1 Tue = 18 slots.
    SELECT sp_generate_slots(v_doc1_uid, DATE '2026-11-23', DATE '2026-11-29') INTO v_slots_gen;
    IF v_slots_gen <> 18 THEN
        RAISE EXCEPTION 'TEST FAILED: Expected 18 slots generated, got %', v_slots_gen;
    END IF;
    RAISE NOTICE '  [PASS] T6.1: sp_generate_slots generated exact expected count (18 slots across 2 days)';

    -- T6.2: Idempotency - Calling again for exact same range adds 0 slots
    SELECT sp_generate_slots(v_doc1_uid, DATE '2026-11-23', DATE '2026-11-29') INTO v_slots_gen;
    IF v_slots_gen <> 0 THEN
        RAISE EXCEPTION 'TEST FAILED: Idempotency failed, added % extra slots', v_slots_gen;
    END IF;
    RAISE NOTICE '  [PASS] T6.2: sp_generate_slots is strictly idempotent (0 duplicate slots created)';

    -- T6.3: Inverted date range rejected
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_generate_slots(v_doc1_uid, DATE '2026-11-29', DATE '2026-11-23');
    EXCEPTION
        WHEN others THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: Inverted date range was not rejected';
    END IF;
    RAISE NOTICE '  [PASS] T6.3: Inverted date range correctly rejected';

    -- T6.4: Non-existent doctor ID rejected
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_generate_slots(99999, DATE '2026-11-23', DATE '2026-11-29');
    EXCEPTION
        WHEN others THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: Non-existent doctor was not rejected';
    END IF;
    RAISE NOTICE '  [PASS] T6.4: Non-existent doctor ID correctly rejected';

    -- T6.5: Generate across all doctors
    SELECT sp_generate_all_slots(DATE '2026-11-30', DATE '2026-12-06') INTO v_slots_gen;
    RAISE NOTICE '  [PASS] T6.5: sp_generate_all_slots ran across all doctors (% slots created)', v_slots_gen;

    -- ========================================================================
    -- TEST GROUP 7: Doctor API Helpers & Views
    -- ========================================================================
    RAISE NOTICE '[GROUP 7] Doctor API Helpers & Views';

    -- T7.1: sp_add_availability and sp_delete_availability
    SELECT * INTO v_avail_row FROM sp_add_availability(v_doc1_uid, 3, TIME '10:00:00', TIME '12:00:00', 30);
    IF v_avail_row.avail_id IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: sp_add_availability did not return inserted row';
    END IF;
    PERFORM sp_delete_availability(v_doc1_uid, v_avail_row.avail_id);
    RAISE NOTICE '  [PASS] T7.1: sp_add_availability and sp_delete_availability work cleanly';

    -- T7.2: Ownership check on sp_delete_availability (Doctor 2 cannot delete Doctor 1 row)
    SELECT * INTO v_avail_row FROM sp_add_availability(v_doc1_uid, 4, TIME '10:00:00', TIME '11:00:00', 30);
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_delete_availability(v_doc2_uid, v_avail_row.avail_id);
    EXCEPTION
        WHEN no_data_found THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: sp_delete_availability allowed deleting another doctor availability';
    END IF;
    RAISE NOTICE '  [PASS] T7.2: Blocked deleting another doctor availability window';

    -- T7.3: sp_set_appointment_status (ownership + R5 lifecycle check)
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_set_appointment_status(v_doc2_uid, v_appt4_id, 'COMPLETED');
    EXCEPTION
        WHEN insufficient_privilege THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: Doctor 2 updated Doctor 1 appointment';
    END IF;
    SELECT * INTO v_appt_row FROM sp_set_appointment_status(v_doc1_uid, v_appt4_id, 'COMPLETED');
    IF v_appt_row.status <> 'COMPLETED' THEN
        RAISE EXCEPTION 'TEST FAILED: sp_set_appointment_status did not update to COMPLETED';
    END IF;
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_set_appointment_status(v_doc1_uid, v_appt4_id, 'NO_SHOW');
    EXCEPTION
        WHEN check_violation THEN
            IF SQLERRM LIKE 'R5:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: sp_set_appointment_status allowed transition out of COMPLETED';
    END IF;
    RAISE NOTICE '  [PASS] T7.3: sp_set_appointment_status enforces ownership and R5 lifecycle';

    -- T7.4: sp_toggle_slot_block (FREE <-> BLOCKED, and rejects BOOKED slot with R5)
    SELECT * INTO v_slot_row FROM sp_toggle_slot_block(v_doc1_uid, v_slot5_id, TRUE);
    IF v_slot_row.status <> 'BLOCKED' THEN
        RAISE EXCEPTION 'TEST FAILED: Expected BLOCKED slot status';
    END IF;
    SELECT * INTO v_slot_row FROM sp_toggle_slot_block(v_doc1_uid, v_slot5_id, FALSE);
    IF v_slot_row.status <> 'FREE' THEN
        RAISE EXCEPTION 'TEST FAILED: Expected FREE slot status after unblock';
    END IF;
    UPDATE slot SET status = 'BOOKED' WHERE slot_id = v_slot5_id;
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_toggle_slot_block(v_doc1_uid, v_slot5_id, TRUE);
    EXCEPTION
        WHEN check_violation THEN
            IF SQLERRM LIKE 'R5:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: sp_toggle_slot_block allowed blocking a BOOKED slot';
    END IF;
    RAISE NOTICE '  [PASS] T7.4: sp_toggle_slot_block toggles FREE <-> BLOCKED and blocks BOOKED (R5)';

    -- T7.5: Views return expected rows
    SELECT COUNT(*) INTO v_view_cnt FROM v_doctor_profile WHERE doctor_id = v_doc1_uid;
    IF v_view_cnt <> 1 THEN
        RAISE EXCEPTION 'TEST FAILED: v_doctor_profile expected 1 row for doctor, got %', v_view_cnt;
    END IF;
    SELECT COUNT(*) INTO v_view_cnt FROM v_doctor_appointments WHERE doctor_id = v_doc1_uid;
    IF v_view_cnt < 1 THEN
        RAISE EXCEPTION 'TEST FAILED: v_doctor_appointments returned 0 rows for doctor';
    END IF;
    RAISE NOTICE '  [PASS] T7.5: v_doctor_profile and v_doctor_appointments verified';

    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'ALL 40 SCHEDULE TESTS PASSED (R2, R4, R5, R8, scheduling & views)';
    RAISE NOTICE '======================================================================';
END;
$$;

ROLLBACK;
