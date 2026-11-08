-- ============================================================================
-- MediSlot: Doctor Appointment Booking System
-- Group 6 | Mohammad Mubeen Khan (2024A8PS0489H)
-- File: db/tests/test_booking.sql
-- Description: Test suite for Rules R1, R3, R7, R9, the booking transaction
--              (sp_book_appointment), cancellation (sp_cancel_appointment) and
--              the slot-status sync trigger. Slot times are relative to now()
--              because R7 and R9 depend on the clock.
--              Requires 01_tables.sql, 02_schedule.sql and 03_booking.sql.
--              The two-session race is in test_booking_race.sql.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
    v_base        TIMESTAMPTZ := date_trunc('minute', now());
    v_clinic_id   INT;
    v_spec_id     INT;
    v_doc1        INT;
    v_doc2        INT;
    v_pat1        INT;
    v_pat2        INT;
    v_adm         INT;
    v_s48         INT;   -- doctor 1, now + 48 h
    v_s48_adj     INT;   -- doctor 1, right after v_s48
    v_s5          INT;   -- doctor 1, now + 5 h
    v_s1          INT;   -- doctor 1, now + 1 h
    v_s72         INT;   -- doctor 1, now + 72 h
    v_past        INT;   -- doctor 1, started 1 h ago
    v_past2       INT;   -- doctor 1, started 3 h ago
    v_blocked     INT;   -- doctor 1, BLOCKED
    v_d2_overlap  INT;   -- doctor 2, overlaps v_s48
    v_appt        INT;
    v_appt2       INT;
    v_appt_past   INT;
    v_refund      NUMERIC;
    v_status      TEXT;
    v_count       INT;
    v_test_failed BOOLEAN;
BEGIN
    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'Running MediSlot Booking Test Suite (Group 6 - Mohammad Mubeen Khan)';
    RAISE NOTICE '======================================================================';

    -- ------------------------------------------------------------------------
    -- FIXTURES SETUP
    -- ------------------------------------------------------------------------
    INSERT INTO clinic (name, address, city)
    VALUES ('Booking Test Clinic', 'Jawahar Nagar, Kapra', 'Hyderabad')
    RETURNING clinic_id INTO v_clinic_id;

    INSERT INTO specialty (name)
    VALUES ('Booking Test Cardiology')
    RETURNING specialty_id INTO v_spec_id;

    INSERT INTO app_user (full_name, email, phone, password_hash, role)
    VALUES ('Dr. Kavya Rao', 'kavya.rao@bookingtest.com', '9000000001', 'x', 'DOCTOR')
    RETURNING user_id INTO v_doc1;
    INSERT INTO app_user (full_name, email, phone, password_hash, role)
    VALUES ('Dr. Imran Shaikh', 'imran.shaikh@bookingtest.com', '9000000002', 'x', 'DOCTOR')
    RETURNING user_id INTO v_doc2;
    INSERT INTO app_user (full_name, email, phone, password_hash, role)
    VALUES ('Arjun Mehta', 'arjun.mehta@bookingtest.com', '9000000003', 'x', 'PATIENT')
    RETURNING user_id INTO v_pat1;
    INSERT INTO app_user (full_name, email, phone, password_hash, role)
    VALUES ('Sneha Iyer', 'sneha.iyer@bookingtest.com', '9000000004', 'x', 'PATIENT')
    RETURNING user_id INTO v_pat2;
    INSERT INTO app_user (full_name, email, phone, password_hash, role)
    VALUES ('Booking Admin', 'admin@bookingtest.com', '9000000005', 'x', 'ADMIN')
    RETURNING user_id INTO v_adm;

    INSERT INTO doctor (doctor_id, clinic_id, specialty_id, license_no, fee, experience_yrs)
    VALUES (v_doc1, v_clinic_id, v_spec_id, 'LIC-BK-001', 600.00, 12);
    INSERT INTO doctor (doctor_id, clinic_id, specialty_id, license_no, fee, experience_yrs)
    VALUES (v_doc2, v_clinic_id, v_spec_id, 'LIC-BK-002', 333.33, 4);

    INSERT INTO patient (patient_id, dob, gender) VALUES (v_pat1, DATE '1999-02-14', 'M');
    INSERT INTO patient (patient_id, dob, gender) VALUES (v_pat2, DATE '2002-07-30', 'F');

    INSERT INTO slot (doctor_id, slot_start, slot_end)
    VALUES (v_doc1, v_base + INTERVAL '48 hours', v_base + INTERVAL '48 hours 30 minutes')
    RETURNING slot_id INTO v_s48;
    INSERT INTO slot (doctor_id, slot_start, slot_end)
    VALUES (v_doc1, v_base + INTERVAL '48 hours 30 minutes', v_base + INTERVAL '49 hours')
    RETURNING slot_id INTO v_s48_adj;
    INSERT INTO slot (doctor_id, slot_start, slot_end)
    VALUES (v_doc1, v_base + INTERVAL '5 hours', v_base + INTERVAL '5 hours 30 minutes')
    RETURNING slot_id INTO v_s5;
    INSERT INTO slot (doctor_id, slot_start, slot_end)
    VALUES (v_doc1, v_base + INTERVAL '1 hour', v_base + INTERVAL '1 hour 30 minutes')
    RETURNING slot_id INTO v_s1;
    INSERT INTO slot (doctor_id, slot_start, slot_end)
    VALUES (v_doc1, v_base + INTERVAL '72 hours', v_base + INTERVAL '72 hours 30 minutes')
    RETURNING slot_id INTO v_s72;
    INSERT INTO slot (doctor_id, slot_start, slot_end)
    VALUES (v_doc1, v_base - INTERVAL '1 hour', v_base - INTERVAL '30 minutes')
    RETURNING slot_id INTO v_past;
    INSERT INTO slot (doctor_id, slot_start, slot_end)
    VALUES (v_doc1, v_base - INTERVAL '3 hours', v_base - INTERVAL '2 hours 30 minutes')
    RETURNING slot_id INTO v_past2;
    INSERT INTO slot (doctor_id, slot_start, slot_end, status)
    VALUES (v_doc1, v_base + INTERVAL '96 hours', v_base + INTERVAL '96 hours 30 minutes', 'BLOCKED')
    RETURNING slot_id INTO v_blocked;
    INSERT INTO slot (doctor_id, slot_start, slot_end)
    VALUES (v_doc2, v_base + INTERVAL '48 hours 10 minutes', v_base + INTERVAL '48 hours 40 minutes')
    RETURNING slot_id INTO v_d2_overlap;

    -- ========================================================================
    -- TEST GROUP 1: Booking transaction and Rule R1 (one live booking per slot)
    -- ========================================================================
    RAISE NOTICE '[GROUP 1] Booking transaction and Rule R1';

    -- T1.1: PASS - Book a free slot; appointment, payment and slot status all agree
    v_appt := sp_book_appointment(v_pat1, v_s48, 'UPI', 'Palpitations');
    IF (SELECT status FROM slot WHERE slot_id = v_s48) <> 'BOOKED' THEN
        RAISE EXCEPTION 'TEST FAILED: slot not marked BOOKED after booking';
    END IF;
    IF (SELECT amount FROM payment WHERE appt_id = v_appt) <> 600.00 THEN
        RAISE EXCEPTION 'TEST FAILED: payment amount does not snapshot the doctor fee';
    END IF;
    IF (SELECT status FROM appointment WHERE appt_id = v_appt) <> 'BOOKED' THEN
        RAISE EXCEPTION 'TEST FAILED: new appointment not in BOOKED state';
    END IF;
    RAISE NOTICE '  [PASS] T1.1: Booked slot; slot BOOKED, payment = fee snapshot (600.00)';

    -- T1.2: PASS - Fee snapshot survives a later fee change
    UPDATE doctor SET fee = 900.00 WHERE doctor_id = v_doc1;
    IF (SELECT amount FROM payment WHERE appt_id = v_appt) <> 600.00 THEN
        RAISE EXCEPTION 'TEST FAILED: payment amount changed with doctor fee';
    END IF;
    UPDATE doctor SET fee = 600.00 WHERE doctor_id = v_doc1;
    RAISE NOTICE '  [PASS] T1.2: Payment keeps the fee charged at booking time';

    -- T1.3: FAIL - Second patient books the same slot through the function
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_book_appointment(v_pat2, v_s48, 'CARD');
    EXCEPTION
        WHEN unique_violation THEN
            IF SQLERRM LIKE 'R1:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: R1 allowed a second booking of the same slot';
    END IF;
    RAISE NOTICE '  [PASS] T1.3: Blocked second booking of a BOOKED slot (R1)';

    -- T1.4: FAIL - Direct INSERT bypassing the function is still caught by the trigger
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO appointment (patient_id, slot_id) VALUES (v_pat2, v_s48);
    EXCEPTION
        WHEN unique_violation THEN
            IF SQLERRM LIKE 'R1:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: direct INSERT double-booked a slot';
    END IF;
    RAISE NOTICE '  [PASS] T1.4: Direct INSERT on a BOOKED slot blocked by trigger (R1)';

    -- T1.5: FAIL - A BLOCKED slot cannot be booked
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_book_appointment(v_pat2, v_blocked, 'CARD');
    EXCEPTION
        WHEN unique_violation THEN
            IF SQLERRM LIKE 'R1:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: booked a BLOCKED slot';
    END IF;
    RAISE NOTICE '  [PASS] T1.5: Blocked booking of a BLOCKED slot (R1)';

    -- T1.6: FAIL - Non-existent slot
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_book_appointment(v_pat2, -1, 'CARD');
    EXCEPTION
        WHEN foreign_key_violation THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: booked a slot that does not exist';
    END IF;
    RAISE NOTICE '  [PASS] T1.6: Rejected non-existent slot';

    -- T1.7: FAIL - An admin account cannot book (it has no patient row)
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_book_appointment(v_adm, v_s72, 'CARD');
    EXCEPTION
        WHEN foreign_key_violation THEN
            IF SQLERRM LIKE 'R8:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: admin account booked an appointment';
    END IF;
    RAISE NOTICE '  [PASS] T1.7: Rejected booking by a non-patient account';

    -- T1.8: FAIL - Atomicity: a bad payment method rolls back the appointment too
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_book_appointment(v_pat2, v_s72, 'BITCOIN');
    EXCEPTION
        WHEN check_violation THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: invalid payment method accepted';
    END IF;
    IF (SELECT status FROM slot WHERE slot_id = v_s72) <> 'FREE'
       OR EXISTS (SELECT 1 FROM appointment WHERE slot_id = v_s72) THEN
        RAISE EXCEPTION 'TEST FAILED: failed payment left a half-made booking behind';
    END IF;
    RAISE NOTICE '  [PASS] T1.8: Failed payment rolled back appointment; slot still FREE';

    -- ========================================================================
    -- TEST GROUP 2: Rule R3 (no overlapping appointments for one patient)
    -- ========================================================================
    RAISE NOTICE '[GROUP 2] Rule R3: Patient Appointment Overlap';

    -- T2.1: FAIL - Patient 1 books another doctor at an overlapping time
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_book_appointment(v_pat1, v_d2_overlap, 'UPI');
    EXCEPTION
        WHEN exclusion_violation THEN
            IF SQLERRM LIKE 'R3:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: R3 allowed overlapping appointments for one patient';
    END IF;
    RAISE NOTICE '  [PASS] T2.1: Blocked overlapping appointment with a different doctor (R3)';

    -- T2.2: FAIL - Same check applies to a direct INSERT
    v_test_failed := FALSE;
    BEGIN
        INSERT INTO appointment (patient_id, slot_id) VALUES (v_pat1, v_d2_overlap);
    EXCEPTION
        WHEN exclusion_violation THEN
            IF SQLERRM LIKE 'R3:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: direct INSERT bypassed R3';
    END IF;
    RAISE NOTICE '  [PASS] T2.2: Direct INSERT of overlapping appointment blocked (R3)';

    -- T2.3: PASS - Back-to-back slot (starts when the first ends) is allowed
    v_appt2 := sp_book_appointment(v_pat1, v_s48_adj, 'CARD');
    RAISE NOTICE '  [PASS] T2.3: Back-to-back appointment permitted (half-open ranges)';

    -- T2.4: PASS - A different patient may take the overlapping slot
    PERFORM sp_book_appointment(v_pat2, v_d2_overlap, 'NETBANKING');
    RAISE NOTICE '  [PASS] T2.4: Different patient booked the overlapping time';

    -- ========================================================================
    -- TEST GROUP 3: Rule R9 (no booking of a slot that has started)
    -- ========================================================================
    RAISE NOTICE '[GROUP 3] Rule R9: Started Slots';

    -- T3.1: FAIL - Slot started an hour ago
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_book_appointment(v_pat2, v_past, 'CASH');
    EXCEPTION
        WHEN check_violation THEN
            IF SQLERRM LIKE 'R9:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: R9 allowed booking a slot in the past';
    END IF;
    RAISE NOTICE '  [PASS] T3.1: Blocked booking of a slot that has started (R9)';

    -- T3.2: FAIL - p_at override is refused unless seeding
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_book_appointment(v_pat2, v_s72, 'CASH', NULL, now() - INTERVAL '10 days');
    EXCEPTION
        WHEN raise_exception THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: p_at accepted outside seeding';
    END IF;
    RAISE NOTICE '  [PASS] T3.2: Timestamp override refused outside seeding mode';

    -- T3.3: PASS - With medislot.seeding on, a past slot can be booked (seed bypass)
    PERFORM set_config('medislot.seeding', 'on', TRUE);
    v_appt_past := sp_book_appointment(v_pat2, v_past2, 'CASH', 'Seeded past visit',
                                       v_base - INTERVAL '5 days');
    IF (SELECT booked_at FROM appointment WHERE appt_id = v_appt_past) <> v_base - INTERVAL '5 days' THEN
        RAISE EXCEPTION 'TEST FAILED: seeding p_at not used for booked_at';
    END IF;
    PERFORM set_config('medislot.seeding', 'off', TRUE);
    RAISE NOTICE '  [PASS] T3.3: Seeding bypass books a past slot with a historical booked_at';

    -- T3.4: FAIL - Seeding does not switch off the other rules (R1 still applies)
    PERFORM set_config('medislot.seeding', 'on', TRUE);
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_book_appointment(v_pat1, v_past2, 'CASH');
    EXCEPTION
        WHEN unique_violation THEN v_test_failed := TRUE;
    END;
    PERFORM set_config('medislot.seeding', 'off', TRUE);
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: seeding bypassed R1';
    END IF;
    RAISE NOTICE '  [PASS] T3.4: Seeding mode still enforces R1';

    -- ========================================================================
    -- TEST GROUP 4: Rule R7 (refund tiers) and cancellation
    -- ========================================================================
    RAISE NOTICE '[GROUP 4] Rule R7: Refund Tiers and Cancellation';

    -- T4.1: fn_refund_amount at the exact edges
    IF fn_refund_amount(600, '2026-12-02 10:00+05:30', '2026-12-01 10:00+05:30') <> 600 THEN
        RAISE EXCEPTION 'TEST FAILED: exactly 24 h should refund 100%%';
    END IF;
    IF fn_refund_amount(600, '2026-12-02 10:00+05:30', '2026-12-01 10:00:01+05:30') <> 300 THEN
        RAISE EXCEPTION 'TEST FAILED: just under 24 h should refund 50%%';
    END IF;
    IF fn_refund_amount(600, '2026-12-02 10:00+05:30', '2026-12-02 08:00+05:30') <> 300 THEN
        RAISE EXCEPTION 'TEST FAILED: exactly 2 h should refund 50%%';
    END IF;
    IF fn_refund_amount(600, '2026-12-02 10:00+05:30', '2026-12-02 08:00:01+05:30') <> 0 THEN
        RAISE EXCEPTION 'TEST FAILED: just under 2 h should refund nothing';
    END IF;
    IF fn_refund_amount(333.33, '2026-12-02 10:00+05:30', '2026-12-02 05:00+05:30') <> 166.67 THEN
        RAISE EXCEPTION 'TEST FAILED: 50%% refund not rounded to paise';
    END IF;
    RAISE NOTICE '  [PASS] T4.1: Refund edges: 24h=100%%, <24h=50%%, 2h=50%%, <2h=0, rounding OK';

    -- T4.2: PASS - Cancel 48 h ahead: full refund, REFUNDED, slot FREE again
    v_refund := sp_cancel_appointment(v_appt, v_pat1);
    SELECT status INTO v_status FROM payment WHERE appt_id = v_appt;
    IF v_refund <> 600.00 OR v_status <> 'REFUNDED' THEN
        RAISE EXCEPTION 'TEST FAILED: 48 h cancel gave refund % status %', v_refund, v_status;
    END IF;
    IF (SELECT status FROM slot WHERE slot_id = v_s48) <> 'FREE' THEN
        RAISE EXCEPTION 'TEST FAILED: slot not freed after cancellation';
    END IF;
    IF (SELECT cancelled_at FROM appointment WHERE appt_id = v_appt) IS NULL THEN
        RAISE EXCEPTION 'TEST FAILED: cancelled_at not set';
    END IF;
    RAISE NOTICE '  [PASS] T4.2: >=24 h cancel: 100%% refund, REFUNDED, slot back to FREE';

    -- T4.3: PASS - Freed slot can be booked again; the cancelled row stays as history
    -- (patient 1 again: patient 2 holds the overlapping doctor 2 slot, so R3 would stop them)
    PERFORM sp_book_appointment(v_pat1, v_s48, 'UPI');
    SELECT count(*) INTO v_count FROM appointment WHERE slot_id = v_s48;
    IF v_count <> 2 THEN
        RAISE EXCEPTION 'TEST FAILED: expected 2 appointment rows on re-booked slot, got %', v_count;
    END IF;
    RAISE NOTICE '  [PASS] T4.3: Cancelled slot re-booked; cancelled row kept as history';

    -- T4.4: PASS - Cancel 5 h ahead: 50%, PARTIAL_REFUND
    v_appt := sp_book_appointment(v_pat1, v_s5, 'CARD');
    v_refund := sp_cancel_appointment(v_appt, v_pat1);
    SELECT status INTO v_status FROM payment WHERE appt_id = v_appt;
    IF v_refund <> 300.00 OR v_status <> 'PARTIAL_REFUND' THEN
        RAISE EXCEPTION 'TEST FAILED: 5 h cancel gave refund % status %', v_refund, v_status;
    END IF;
    RAISE NOTICE '  [PASS] T4.4: 2-24 h cancel: 50%% refund, PARTIAL_REFUND';

    -- T4.5: PASS - Cancel 1 h ahead: nothing back, payment stays PAID
    v_appt := sp_book_appointment(v_pat1, v_s1, 'CARD');
    v_refund := sp_cancel_appointment(v_appt, v_pat1);
    SELECT status INTO v_status FROM payment WHERE appt_id = v_appt;
    IF v_refund <> 0 OR v_status <> 'PAID' THEN
        RAISE EXCEPTION 'TEST FAILED: 1 h cancel gave refund % status %', v_refund, v_status;
    END IF;
    RAISE NOTICE '  [PASS] T4.5: <2 h cancel: no refund, payment stays PAID';

    -- T4.6: FAIL - Cancelling twice
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_cancel_appointment(v_appt, v_pat1);
    EXCEPTION
        WHEN check_violation THEN
            IF SQLERRM LIKE 'R5:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: cancelled the same appointment twice';
    END IF;
    RAISE NOTICE '  [PASS] T4.6: Blocked second cancellation (R5)';

    -- T4.7: FAIL - Cancelling someone else's appointment
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_cancel_appointment(v_appt2, v_pat2);
    EXCEPTION
        WHEN insufficient_privilege THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: patient cancelled another patient''s appointment';
    END IF;
    RAISE NOTICE '  [PASS] T4.7: Blocked cancellation by a different patient';

    -- T4.8: FAIL - Cancelling an appointment that has already started
    v_test_failed := FALSE;
    BEGIN
        PERFORM sp_cancel_appointment(v_appt_past, v_pat2);
    EXCEPTION
        WHEN check_violation THEN
            IF SQLERRM LIKE 'R7:%' THEN v_test_failed := TRUE; END IF;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: cancelled an appointment that already started';
    END IF;
    RAISE NOTICE '  [PASS] T4.8: Blocked cancellation after the slot started (R7)';

    -- T4.9: FAIL - Payment CHECK rejects a refund that disagrees with the status
    v_test_failed := FALSE;
    BEGIN
        UPDATE payment SET refund_amount = 100.00 WHERE appt_id = v_appt2;
    EXCEPTION
        WHEN check_violation THEN v_test_failed := TRUE;
    END;
    IF NOT v_test_failed THEN
        RAISE EXCEPTION 'TEST FAILED: payment refund/status mismatch accepted';
    END IF;
    RAISE NOTICE '  [PASS] T4.9: Payment status must agree with refund amount (CHECK)';

    -- T4.10: PASS - Seeded historical cancellation lands in the tier for its own time
    PERFORM set_config('medislot.seeding', 'on', TRUE);
    v_appt := sp_book_appointment(v_pat2, v_s72, 'UPI', NULL, v_base - INTERVAL '2 days');
    v_refund := sp_cancel_appointment(v_appt, v_pat2, v_base + INTERVAL '60 hours');
    PERFORM set_config('medislot.seeding', 'off', TRUE);
    IF v_refund <> 300.00 THEN
        RAISE EXCEPTION 'TEST FAILED: seeded cancel 12 h before slot gave refund %', v_refund;
    END IF;
    RAISE NOTICE '  [PASS] T4.10: Seeded cancellation uses its own timestamp for the tier';

    -- ========================================================================
    -- TEST GROUP 5: Views used by the booking API
    -- ========================================================================
    RAISE NOTICE '[GROUP 5] Booking Views';

    -- T5.1: v_patient_appointments shows the refund preview only for live future bookings
    IF (SELECT refund_if_cancelled_now FROM v_patient_appointments WHERE appt_id = v_appt2) <> 600.00 THEN
        RAISE EXCEPTION 'TEST FAILED: refund preview wrong for 48 h-ahead booking';
    END IF;
    IF (SELECT refund_if_cancelled_now FROM v_patient_appointments WHERE appt_id = v_appt_past) IS NOT NULL THEN
        RAISE EXCEPTION 'TEST FAILED: refund preview shown for a started appointment';
    END IF;
    RAISE NOTICE '  [PASS] T5.1: v_patient_appointments refund preview correct';

    RAISE NOTICE '======================================================================';
    RAISE NOTICE 'ALL 27 BOOKING TESTS PASSED (R1, R3, R7, R9, booking transaction)';
    RAISE NOTICE '======================================================================';
END;
$$;

ROLLBACK;
