-- ============================================================================
-- MediSlot: Doctor Appointment Booking System
-- Group 6 | Data & Performance seed data
-- File: db/seed.sql
--
-- Run AFTER 01_tables.sql, 02_schedule.sql, 03_booking.sql and 04_clinical.sql
-- Run once on a clean database. This script uses the real booking/cancellation
-- functions so R1, R3, R7, R8 and the slot-status trigger remain in force.
-- ============================================================================

BEGIN;

-- Historical bookings are permitted only for this transaction/session.
SELECT set_config('medislot.seeding', 'on', TRUE);

-- ---------------------------------------------------------------------------
-- 1. Reference data
-- ---------------------------------------------------------------------------

INSERT INTO clinic (name, address, city) VALUES
('MediCare Central', '12 Residency Road', 'Bengaluru'),
('Apollo Care Point', '45 Anna Salai', 'Chennai'),
('Sunrise Multispeciality', '8 Banjara Hills Road', 'Hyderabad'),
('City Health Centre', '21 FC Road', 'Pune'),
('LifeSpring Clinic', '17 Park Street', 'Kolkata'),
('Wellness Medical Hub', '33 MG Road', 'Mumbai');

INSERT INTO specialty (name) VALUES
('Cardiology'),
('Dermatology'),
('ENT'),
('Endocrinology'),
('Gastroenterology'),
('General Medicine'),
('Gynaecology'),
('Neurology'),
('Ophthalmology'),
('Orthopaedics'),
('Paediatrics'),
('Pulmonology');

-- Stable staging maps: never assume SERIAL IDs start at 1.
CREATE TEMP TABLE seed_clinic_map AS
SELECT clinic_id, ROW_NUMBER() OVER (ORDER BY clinic_id)::INT AS clinic_no
FROM clinic
WHERE name IN (
    'MediCare Central', 'Apollo Care Point', 'Sunrise Multispeciality',
    'City Health Centre', 'LifeSpring Clinic', 'Wellness Medical Hub'
);

CREATE TEMP TABLE seed_specialty_map AS
SELECT specialty_id, ROW_NUMBER() OVER (ORDER BY specialty_id)::INT AS specialty_no
FROM specialty
WHERE name IN (
    'Cardiology', 'Dermatology', 'ENT', 'Endocrinology',
    'Gastroenterology', 'General Medicine', 'Gynaecology',
    'Neurology', 'Ophthalmology', 'Orthopaedics', 'Paediatrics',
    'Pulmonology'
);

-- ---------------------------------------------------------------------------
-- 2. Demo doctors and patients
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE seed_doctor_users (
    doctor_no INT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    user_id INT
);

INSERT INTO seed_doctor_users (doctor_no, email)
SELECT n, 'doctor' || n || '@medislot.demo'
FROM generate_series(1, 30) AS g(n);

WITH inserted AS (
    INSERT INTO app_user (full_name, email, phone, password_hash, role)
    SELECT
        'Dr Demo ' || doctor_no,
        email,
        '90000' || LPAD(doctor_no::TEXT, 5, '0'),
        '$2b$10$.O2.cH/5NN0kNc0diRSYaOoukB0/UdQ69jCxkUkS7dvXB4q/Kf.VG',
        'DOCTOR'
    FROM seed_doctor_users
    ORDER BY doctor_no
    RETURNING user_id, email
)
UPDATE seed_doctor_users d
SET user_id = i.user_id
FROM inserted i
WHERE i.email = d.email;

INSERT INTO doctor (
    doctor_id, clinic_id, specialty_id, license_no, fee, experience_yrs
)
SELECT
    u.user_id,
    c.clinic_id,
    s.specialty_id,
    'MED-DEMO-' || LPAD(u.doctor_no::TEXT, 4, '0'),
    (500 + ((u.doctor_no * 137) % 1500))::NUMERIC(10,2),
    1 + (u.doctor_no % 25)
FROM seed_doctor_users u
JOIN seed_clinic_map c
  ON c.clinic_no = ((u.doctor_no - 1) % 6) + 1
JOIN seed_specialty_map s
  ON s.specialty_no = ((u.doctor_no - 1) % 12) + 1;

CREATE TEMP TABLE seed_patient_users (
    patient_no INT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    user_id INT
);

INSERT INTO seed_patient_users (patient_no, email)
SELECT n, 'patient' || n || '@medislot.demo'
FROM generate_series(1, 120) AS g(n);

WITH inserted AS (
    INSERT INTO app_user (full_name, email, phone, password_hash, role)
    SELECT
        'Demo Patient ' || patient_no,
        email,
        '80000' || LPAD(patient_no::TEXT, 5, '0'),
        '$2b$10$.O2.cH/5NN0kNc0diRSYaOoukB0/UdQ69jCxkUkS7dvXB4q/Kf.VG',
        'PATIENT'
    FROM seed_patient_users
    ORDER BY patient_no
    RETURNING user_id, email
)
UPDATE seed_patient_users p
SET user_id = i.user_id
FROM inserted i
WHERE i.email = p.email;

INSERT INTO patient (patient_id, dob, gender)
SELECT
    user_id,
    DATE '1980-01-01' + ((patient_no * 73) % 14000),
    CASE patient_no % 3 WHEN 0 THEN 'M' WHEN 1 THEN 'F' ELSE 'O' END
FROM seed_patient_users;

-- ---------------------------------------------------------------------------
-- 3. Medicines
-- ---------------------------------------------------------------------------

INSERT INTO medicine (name, form, strength) VALUES
('Paracetamol', 'TABLET', '500 mg'),
('Ibuprofen', 'TABLET', '400 mg'),
('Amoxicillin', 'CAPSULE', '500 mg'),
('Azithromycin', 'TABLET', '250 mg'),
('Cetirizine', 'TABLET', '10 mg'),
('Pantoprazole', 'TABLET', '40 mg'),
('Metformin', 'TABLET', '500 mg'),
('Amlodipine', 'TABLET', '5 mg'),
('Atorvastatin', 'TABLET', '10 mg'),
('Losartan', 'TABLET', '50 mg'),
('Omeprazole', 'CAPSULE', '20 mg'),
('Vitamin D3', 'CAPSULE', '60000 IU'),
('Iron Supplement', 'TABLET', '100 mg'),
('Calcium Supplement', 'TABLET', '500 mg'),
('ORS', 'OTHER', 'Standard'),
('Salbutamol', 'OTHER', '2 mg'),
('Diclofenac', 'OINTMENT', '1%'),
('Mupirocin', 'OINTMENT', '2%'),
('Cough Syrup', 'SYRUP', '100 ml'),
('Antacid Syrup', 'SYRUP', '200 ml'),
('Ciprofloxacin', 'DROPS', '0.3%'),
('Lubricating Eye Drops', 'DROPS', '0.5%'),
('Insulin', 'INJECTION', '100 IU/ml'),
('Ondansetron', 'TABLET', '4 mg'),
('Doxycycline', 'CAPSULE', '100 mg');

CREATE TEMP TABLE seed_medicine_map AS
SELECT medicine_id, ROW_NUMBER() OVER (ORDER BY medicine_id)::INT AS medicine_no
FROM medicine
WHERE name IN (
    'Paracetamol', 'Ibuprofen', 'Amoxicillin', 'Azithromycin',
    'Cetirizine', 'Pantoprazole', 'Metformin', 'Amlodipine',
    'Atorvastatin', 'Losartan', 'Omeprazole', 'Vitamin D3',
    'Iron Supplement', 'Calcium Supplement', 'ORS', 'Salbutamol',
    'Diclofenac', 'Mupirocin', 'Cough Syrup', 'Antacid Syrup',
    'Ciprofloxacin', 'Lubricating Eye Drops', 'Insulin',
    'Ondansetron', 'Doxycycline'
);

-- ---------------------------------------------------------------------------
-- 4. Weekly availability and concrete slots
-- ---------------------------------------------------------------------------

-- Five weekdays, 09:00-17:00, 30-minute slots for each of 30 doctors.
INSERT INTO availability (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT d.user_id, wd, TIME '09:00', TIME '17:00', 30
FROM seed_doctor_users d
CROSS JOIN generate_series(1, 5) AS days(wd);

-- Include enough historical and future slots for seed visits and live demos.
SELECT sp_generate_all_slots(CURRENT_DATE - 60, CURRENT_DATE + 30);

-- ---------------------------------------------------------------------------
-- 5. 400 appointments, created through the actual booking function
-- ---------------------------------------------------------------------------

CREATE TEMP TABLE seed_booking_plan AS
SELECT
    q.slot_id,
    q.slot_start,
    q.rn,
    p.user_id AS patient_id,
    CASE
        WHEN q.rn % 10 IN (1, 2) THEN 'CANCELLED'
        WHEN q.rn % 10 = 3 THEN 'NO_SHOW'
        ELSE 'COMPLETED'
    END AS final_status
FROM (
    SELECT
        slot_id,
        slot_start,
        ROW_NUMBER() OVER (ORDER BY slot_start, doctor_id, slot_id)::INT AS rn
    FROM slot
    WHERE status = 'FREE'
      AND slot_start < now() - INTERVAL '2 days'
    ORDER BY slot_start, doctor_id, slot_id
    LIMIT 400
) q
JOIN seed_patient_users p
  ON p.patient_no = ((q.rn - 1) % 120) + 1;

DO $$
DECLARE
    r RECORD;
    v_appt_id INT;
    v_method TEXT;
    v_cancel_at TIMESTAMPTZ;
BEGIN
    IF (SELECT COUNT(*) FROM seed_booking_plan) <> 400 THEN
        RAISE EXCEPTION
            'Seed requires 400 historical free slots; found %',
            (SELECT COUNT(*) FROM seed_booking_plan);
    END IF;

    FOR r IN
        SELECT * FROM seed_booking_plan ORDER BY rn
    LOOP
        v_method := CASE r.rn % 4
            WHEN 0 THEN 'UPI'
            WHEN 1 THEN 'CARD'
            WHEN 2 THEN 'NETBANKING'
            ELSE 'CASH'
        END;

        -- Book 48 hours before the slot. p_at is accepted only in seed mode.
        v_appt_id := sp_book_appointment(
            r.patient_id,
            r.slot_id,
            v_method,
            'Demo appointment ' || r.rn,
            r.slot_start - INTERVAL '48 hours'
        );

        IF r.final_status = 'CANCELLED' THEN
            -- Spread cancellations across all three refund tiers.
            v_cancel_at := CASE r.rn % 3
                WHEN 0 THEN r.slot_start - INTERVAL '30 hours'
                WHEN 1 THEN r.slot_start - INTERVAL '10 hours'
                ELSE r.slot_start - INTERVAL '1 hour'
            END;

            PERFORM sp_cancel_appointment(
                v_appt_id,
                r.patient_id,
                v_cancel_at
            );
        ELSIF r.final_status IN ('COMPLETED', 'NO_SHOW') THEN
            UPDATE appointment
            SET status = r.final_status
            WHERE appt_id = v_appt_id;
        END IF;
    END LOOP;
END;
$$;

-- Keep the generated appointment IDs linked to their deterministic seed order.
CREATE TEMP TABLE seed_appointment_map AS
SELECT
    a.appt_id,
    a.patient_id,
    a.status,
    ROW_NUMBER() OVER (ORDER BY a.booked_at, a.appt_id)::INT AS seed_no
FROM appointment a
WHERE a.reason LIKE 'Demo appointment %';

-- ---------------------------------------------------------------------------
-- 6. Exactly 250 prescription items and 120 reviews
-- ---------------------------------------------------------------------------

WITH completed AS (
    SELECT
        a.appt_id,
        ROW_NUMBER() OVER (ORDER BY a.seed_no)::INT AS completed_no
    FROM seed_appointment_map a
    WHERE a.status = 'COMPLETED'
)
INSERT INTO prescription_item (appt_id, medicine_id, dosage, days_supply)
SELECT
    a.appt_id,
    m.medicine_id,
    CASE a.completed_no % 4
        WHEN 0 THEN '1 tablet twice daily'
        WHEN 1 THEN '1 tablet once daily'
        WHEN 2 THEN '1 capsule after meals'
        ELSE 'As directed by doctor'
    END,
    3 + (a.completed_no % 28)
FROM completed a
JOIN seed_medicine_map m
  ON m.medicine_no = ((a.completed_no - 1) % 25) + 1
WHERE a.completed_no <= 250
ORDER BY a.completed_no;

INSERT INTO review (appt_id, rating, comment)
SELECT
    appt_id,
    3 + (seed_no % 3),
    CASE seed_no % 4
        WHEN 0 THEN 'Very good experience.'
        WHEN 1 THEN 'Doctor was helpful and professional.'
        WHEN 2 THEN 'Appointment process was smooth.'
        ELSE 'Good consultation.'
    END
FROM seed_appointment_map
WHERE status = 'COMPLETED'
ORDER BY seed_no
LIMIT 120;

-- ---------------------------------------------------------------------------
-- 7. Sanity checks
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    v_doctors INT;
    v_patients INT;
    v_slots INT;
    v_appointments INT;
    v_payments INT;
    v_prescriptions INT;
    v_reviews INT;
BEGIN
    SELECT COUNT(*) INTO v_doctors FROM doctor;
    SELECT COUNT(*) INTO v_patients FROM patient;
    SELECT COUNT(*) INTO v_slots FROM slot;
    SELECT COUNT(*) INTO v_appointments
      FROM appointment WHERE reason LIKE 'Demo appointment %';
    SELECT COUNT(*) INTO v_payments
      FROM payment p JOIN appointment a USING (appt_id)
      WHERE a.reason LIKE 'Demo appointment %';
    SELECT COUNT(*) INTO v_prescriptions
      FROM prescription_item pi JOIN appointment a USING (appt_id)
      WHERE a.reason LIKE 'Demo appointment %';
    SELECT COUNT(*) INTO v_reviews
      FROM review r JOIN appointment a USING (appt_id)
      WHERE a.reason LIKE 'Demo appointment %';

    RAISE NOTICE 'Doctors: %, Patients: %, Slots: %',
        v_doctors, v_patients, v_slots;
    RAISE NOTICE 'Seed appointments: %, Payments: %, Prescription items: %, Reviews: %',
        v_appointments, v_payments, v_prescriptions, v_reviews;

    IF v_appointments <> 400 OR v_payments <> 400
       OR v_prescriptions <> 250 OR v_reviews <> 120 THEN
        RAISE EXCEPTION
            'Seed count check failed. Expected 400 appointments, 400 payments, 250 prescription items and 120 reviews.';
    END IF;
END;
$$;

COMMIT;
