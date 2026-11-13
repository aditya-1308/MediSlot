-- ============================================================================
-- MediSlot: Doctor Appointment Booking System
-- Group 6 | Suryanath A
-- File: db/tests/test_clinical.sql
-- Description: Test suite for Rule R6 (prescriptions and reviews only on
--              COMPLETED appointments). Tests both positive and negative cases.
--              Requires 01_tables.sql through 04_clinical.sql.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
    v_clinic_id   INT;
    v_spec_id     INT;
    v_doc_id      INT;
    v_pat_id      INT;
    v_slot_done   INT;   -- slot for a COMPLETED appt
    v_slot_booked INT;   -- slot for a BOOKED appt
    v_appt_done   INT;
    v_appt_booked INT;
    v_med_id      INT;
    v_test_failed BOOLEAN;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'Running MediSlot Clinical Test Suite (Group 6 - Priyadarshini Ghosh)';
    RAISE NOTICE '======================================================================';

    -- ------------------------------------------------------------------------
    -- FIXTURES SETUP
    -- ------------------------------------------------------------------------
    INSERT INTO clinic (name, address, city)
    VALUES ('Clinical Test Clinic', '10 Test Road', 'Delhi')
    RETURNING clinic_id INTO v_clinic_id;

    INSERT INTO specialty (name)
    VALUES ('Clinical Test Specialty')
    RETURNING specialty_id INTO v_spec_id;

    INSERT INTO app_user (full_name, email, phone, password_hash, role)
    VALUES ('Dr. Ravi Kumar', 'ravi.kumar@clinicaltest.com', '9100000001', 'x', 'DOCTOR')
    RETURNING user_id INTO v_doc_id;

    INSERT INTO app_user (full_name, email, phone, password_hash, role)
    VALUES ('Priya Nair', 'priya.nair@clinicaltest.com', '9100000002', 'x', 'PATIENT')
    RETURNING user_id INTO v_pat_id;

    INSERT INTO doctor (doctor_id, clinic_id, specialty_id, license_no, fee, experience_yrs)
    VALUES (v_doc_id, v_clinic_id, v_spec_id, 'LIC-CL-001', 500.00, 8);

    INSERT INTO patient (patient_id, dob, gender)
    VALUES (v_pat_id, DATE '1995-06-15', 'F');

    INSERT INTO medicine (name, form, strength)
    VALUES ('Paracetamol Test', 'TABLET', '500 mg')
    RETURNING medicine_id INTO v_med_id;

    -- slot in the past so we can mark it COMPLETED
    INSERT INTO slot (doctor_id, slot_start, slot_end)
    VALUES (v_doc_id,
            now() - INTERVAL '3 days',
            now() - INTERVAL '3 days' + INTERVAL '30 minutes')
    RETURNING slot_id INTO v_slot_done;

    -- future slot that stays BOOKED
    INSERT INTO slot (doctor_id, slot_start, slot_end)
    VALUES (v_doc_id,
            now() + INTERVAL '48 hours',
            now() + INTERVAL '48 hours 30 minutes')
    RETURNING slot_id INTO v_slot_booked;

    -- book both slots directly (seeding context, bypass R9 for the past slot)
    PERFORM set_config('medislot.seeding', 'on', TRUE);
    v_appt_done := sp_book_appointment(v_pat_id, v_slot_done, 'CASH', 'clinical test past',
                                       now() - INTERVAL '5 days');
    PERFORM set_config('medislot.seeding', 'off', TRUE);

    v_appt_booked := sp_book_appointment(v_pat_id, v_slot_booked, 'UPI', 'clinical test future');

    -- mark the past appointment COMPLETED
    UPDATE appointment SET status = 'COMPLETED' WHERE appt_id = v_appt_done;

    -- ========================================================================
    -- TEST GROUP 1: Prescription inserts (Rule R6)
    -- ========================================================================
    RAISE NOTICE '[GROUP 1] R6: Prescription inserts';

    -- T1.1: PASS - doctor writes prescription on a COMPLETED appointment
    INSERT INTO prescription_item (appt_id, medicine_id, dosage, days_supply)
    VALUES (v_appt_done, v_med_id, '1-0-1', 5);
    RAISE NOTICE '  [PASS] T1.1: Prescription inserted on COMPLETED appointment';

    -- T1.2: FAIL - prescription on a BOOKED appointment must raise R6
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO prescription_item (appt_id, medicine_id, dosage, days_supply)
        VALUES (v_appt_booked, v_med_id, '0-1-0', 3);
    EXCEPTION
        WHEN raise_exception THEN
            IF SQLERRM LIKE 'R6:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: prescription allowed on BOOKED appointment (R6)';
    END IF;
    RAISE NOTICE '  [PASS] T1.2: Prescription blocked on BOOKED appointment (R6)';

    -- ========================================================================
    -- TEST GROUP 2: Review inserts (Rule R6)
    -- ========================================================================
    RAISE NOTICE '[GROUP 2] R6: Review inserts';

    -- T2.1: PASS - patient writes review on a COMPLETED appointment
    INSERT INTO review (appt_id, rating, comment)
    VALUES (v_appt_done, 5, 'Great doctor, very helpful.');
    RAISE NOTICE '  [PASS] T2.1: Review inserted on COMPLETED appointment';

    -- T2.2: FAIL - review on a BOOKED appointment must raise R6
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO review (appt_id, rating, comment)
        VALUES (v_appt_booked, 1, 'Should not work.');
    EXCEPTION
        WHEN raise_exception THEN
            IF SQLERRM LIKE 'R6:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: review allowed on BOOKED appointment (R6)';
    END IF;
    RAISE NOTICE '  [PASS] T2.2: Review blocked on BOOKED appointment (R6)';

    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'ALL 4 CLINICAL TESTS PASSED (R6)';
    RAISE NOTICE '======================================================================';
END;
$$;

ROLLBACK;
