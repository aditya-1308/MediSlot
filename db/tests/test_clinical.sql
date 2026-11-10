-- Test Suite for R6 (Clinical Records QA)
\set QUIET 1
\pset format unaligned
\pset tuples_only on

SELECT '=== RUNNING R6 TESTS ===' AS test_output;

-- 1. Seed prerequisite parent data for strict FK constraints
INSERT INTO app_user (user_id, full_name, email, phone, password_hash, role) VALUES 
    (1, 'Test Patient', 'patient@test.com', '1234567890', 'hash', 'PATIENT'),
    (2, 'Test Doctor', 'doctor@test.com', '0987654321', 'hash', 'DOCTOR');

INSERT INTO patient (patient_id, dob) VALUES (1, '1990-01-01');

INSERT INTO clinic (clinic_id, name, address, city) VALUES (1, 'Test Clinic', '123 Test St', 'City');
INSERT INTO specialty (specialty_id, name) VALUES (1, 'General');

INSERT INTO doctor (doctor_id, clinic_id, specialty_id, license_no, fee, experience_yrs) 
VALUES (2, 1, 1, 'LIC123', 500.00, 5);

INSERT INTO slot (slot_id, doctor_id, slot_start, slot_end) VALUES 
    (1, 2, '2026-11-01 10:00:00+05:30', '2026-11-01 10:30:00+05:30'),
    (2, 2, '2026-11-01 10:30:00+05:30', '2026-11-01 11:00:00+05:30'),
    (3, 2, '2026-11-01 11:00:00+05:30', '2026-11-01 11:30:00+05:30'),
    (4, 2, '2026-11-01 11:30:00+05:30', '2026-11-01 12:00:00+05:30');

-- 2. Seed test appointments and medicine
INSERT INTO appointment (appt_id, patient_id, slot_id, status, cancelled_at) VALUES 
    (1, 1, 1, 'BOOKED', NULL), 
    (2, 1, 2, 'COMPLETED', NULL), 
    (3, 1, 3, 'NO_SHOW', NULL), 
    (4, 1, 4, 'CANCELLED', CURRENT_TIMESTAMP);

INSERT INTO medicine (medicine_id, name, form, strength) 
VALUES (1, 'Paracetamol', 'TABLET', '500mg');


-- 3. INSERT FAILURE CASES: Should trigger R6 Exceptions
SELECT 'TEST 1: Attempting to add a prescription to a BOOKED appointment (Should Fail)' AS test_output;
INSERT INTO prescription_item (appt_id, medicine_id, dosage, days_supply) 
VALUES (1, 1, '1-0-1', 5);

SELECT 'TEST 2: Attempting to add a review to a NO_SHOW appointment (Should Fail)' AS test_output;
INSERT INTO review (appt_id, rating, comment) 
VALUES (3, 1, 'Doctor was not there.');

SELECT 'TEST 3: Attempting to add a prescription to a CANCELLED appointment (Should Fail)' AS test_output;
INSERT INTO prescription_item (appt_id, medicine_id, dosage, days_supply) 
VALUES (4, 1, '0-1-0', 2);


-- 4. SUCCESS CASES: Should insert cleanly
SELECT 'TEST 4: Adding a prescription to a COMPLETED appointment (Should Succeed)' AS test_output;
INSERT INTO prescription_item (appt_id, medicine_id, dosage, days_supply) 
VALUES (2, 1, '1-1-1', 7);

SELECT 'TEST 5: Adding a review to a COMPLETED appointment (Should Succeed)' AS test_output;
INSERT INTO review (appt_id, rating, comment) 
VALUES (2, 5, 'Great consultation, highly recommended.');


-- 5. UPDATE FAILURE CASES: Checking the UPDATE loophole closure
SELECT 'TEST 6: Attempting to update valid prescription to point to CANCELLED appointment (Should Fail)' AS test_output;
UPDATE prescription_item SET appt_id = 4 WHERE appt_id = 2;

SELECT 'TEST 7: Attempting to update valid review to point to NO_SHOW appointment (Should Fail)' AS test_output;
UPDATE review SET appt_id = 3 WHERE appt_id = 2;


-- 6. Verify Success Insertions and Blocked Updates
SELECT '=== VERIFYING FINAL STATE ===' AS test_output;
SELECT 'Prescriptions found on appt 2: ' || count(*) FROM prescription_item WHERE appt_id = 2;
SELECT 'Reviews found on appt 2: ' || count(*) FROM review WHERE appt_id = 2;
SELECT 'Prescriptions bypassed to appt 4: ' || count(*) FROM prescription_item WHERE appt_id = 4;