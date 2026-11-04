-- ============================================================================
-- MediSlot: Doctor Appointment Booking System
-- Group 6 | Aditya Singh (2024A8PS0491H)
-- File: db/01_tables.sql
-- Description: Core DDL definitions for all 12 tables, primary keys, foreign keys,
--              domain CHECK constraints, composite (id, role) FK (R8),
--              EXCLUDE constraint for slot overlap (R2), and partial unique index.
-- Adheres strictly to the Mid-Sem ER Diagram and Relational Schema.
-- ============================================================================

-- Required for GiST exclusion constraint on (doctor_id =, tstzrange &&)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Clean slate drop in reverse dependency order
DROP TABLE IF EXISTS review CASCADE;
DROP TABLE IF EXISTS prescription_item CASCADE;
DROP TABLE IF EXISTS medicine CASCADE;
DROP TABLE IF EXISTS payment CASCADE;
DROP TABLE IF EXISTS appointment CASCADE;
DROP TABLE IF EXISTS slot CASCADE;
DROP TABLE IF EXISTS availability CASCADE;
DROP TABLE IF EXISTS doctor CASCADE;
DROP TABLE IF EXISTS patient CASCADE;
DROP TABLE IF EXISTS specialty CASCADE;
DROP TABLE IF EXISTS clinic CASCADE;
DROP TABLE IF EXISTS app_user CASCADE;

-- ----------------------------------------------------------------------------
-- 1. app_user (Supertype)
-- ----------------------------------------------------------------------------
CREATE TABLE app_user (
    user_id       SERIAL PRIMARY KEY,
    full_name     VARCHAR(120) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    phone         VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(10) NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_app_user_email UNIQUE (email),
    CONSTRAINT chk_app_user_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT chk_app_user_phone CHECK (phone ~ '^[0-9]{10,15}$'),
    CONSTRAINT chk_app_user_role CHECK (role IN ('PATIENT', 'DOCTOR', 'ADMIN')),
    -- Target for subtype composite foreign keys enforcing Rule R8
    CONSTRAINT uq_app_user_id_role UNIQUE (user_id, role)
);

-- ----------------------------------------------------------------------------
-- 2. patient (Subtype of app_user)
-- Rule R8: (patient_id, role) references app_user(user_id, role) with role = 'PATIENT'
-- ----------------------------------------------------------------------------
CREATE TABLE patient (
    patient_id INT PRIMARY KEY,
    role       VARCHAR(10) NOT NULL DEFAULT 'PATIENT',
    dob        DATE NOT NULL,
    gender     CHAR(1),

    CONSTRAINT chk_patient_role CHECK (role = 'PATIENT'),
    CONSTRAINT chk_patient_gender CHECK (gender IS NULL OR gender IN ('M', 'F', 'O')),
    CONSTRAINT chk_patient_dob CHECK (dob >= DATE '1900-01-01' AND dob <= CURRENT_DATE),
    CONSTRAINT fk_patient_app_user FOREIGN KEY (patient_id, role)
        REFERENCES app_user (user_id, role) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 3. clinic
-- ----------------------------------------------------------------------------
CREATE TABLE clinic (
    clinic_id SERIAL PRIMARY KEY,
    name      VARCHAR(150) NOT NULL,
    address   TEXT NOT NULL,
    city      VARCHAR(100) NOT NULL,

    CONSTRAINT uq_clinic_name_address UNIQUE (name, address)
);

-- ----------------------------------------------------------------------------
-- 4. specialty
-- ----------------------------------------------------------------------------
CREATE TABLE specialty (
    specialty_id SERIAL PRIMARY KEY,
    name         VARCHAR(100) NOT NULL,

    CONSTRAINT uq_specialty_name UNIQUE (name)
);

-- ----------------------------------------------------------------------------
-- 5. doctor (Subtype of app_user)
-- Rule R8: (doctor_id, role) references app_user(user_id, role) with role = 'DOCTOR'
-- ----------------------------------------------------------------------------
CREATE TABLE doctor (
    doctor_id      INT PRIMARY KEY,
    role           VARCHAR(10) NOT NULL DEFAULT 'DOCTOR',
    clinic_id      INT NOT NULL,
    specialty_id   INT NOT NULL,
    license_no     VARCHAR(50) NOT NULL,
    fee            NUMERIC(10, 2) NOT NULL,
    experience_yrs INT NOT NULL,

    CONSTRAINT chk_doctor_role CHECK (role = 'DOCTOR'),
    CONSTRAINT chk_doctor_fee CHECK (fee >= 0),
    CONSTRAINT chk_doctor_experience CHECK (experience_yrs BETWEEN 0 AND 60),
    CONSTRAINT uq_doctor_license_no UNIQUE (license_no),
    CONSTRAINT fk_doctor_app_user FOREIGN KEY (doctor_id, role)
        REFERENCES app_user (user_id, role) ON DELETE CASCADE,
    CONSTRAINT fk_doctor_clinic FOREIGN KEY (clinic_id)
        REFERENCES clinic (clinic_id) ON DELETE RESTRICT,
    CONSTRAINT fk_doctor_specialty FOREIGN KEY (specialty_id)
        REFERENCES specialty (specialty_id) ON DELETE RESTRICT
);

-- ----------------------------------------------------------------------------
-- 6. availability (Weak entity identifying with doctor)
-- Rule R4 divisibility CHECK (overlap trigger is in 02_schedule.sql)
-- ----------------------------------------------------------------------------
CREATE TABLE availability (
    avail_id     SERIAL PRIMARY KEY,
    doctor_id    INT NOT NULL,
    weekday      SMALLINT NOT NULL,
    start_time   TIME NOT NULL,
    end_time     TIME NOT NULL,
    slot_minutes INT NOT NULL,

    CONSTRAINT chk_avail_weekday CHECK (weekday BETWEEN 1 AND 7),
    CONSTRAINT chk_avail_time_order CHECK (end_time > start_time),
    CONSTRAINT chk_avail_slot_minutes CHECK (slot_minutes IN (10, 15, 20, 30, 45, 60)),
    -- Window length must be an exact multiple of slot_minutes (Rule R4)
    CONSTRAINT chk_avail_window_divisible CHECK (
        (EXTRACT(EPOCH FROM (end_time - start_time))::INT / 60) % slot_minutes = 0
    ),
    CONSTRAINT fk_availability_doctor FOREIGN KEY (doctor_id)
        REFERENCES doctor (doctor_id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- 7. slot (Weak entity identifying with doctor)
-- Rule R2: Exclusion constraint preventing doctor from having overlapping slots
-- ----------------------------------------------------------------------------
CREATE TABLE slot (
    slot_id    SERIAL PRIMARY KEY,
    doctor_id  INT NOT NULL,
    slot_start TIMESTAMPTZ NOT NULL,
    slot_end   TIMESTAMPTZ NOT NULL,
    status     VARCHAR(10) NOT NULL DEFAULT 'FREE',

    CONSTRAINT chk_slot_time_order CHECK (slot_end > slot_start),
    CONSTRAINT chk_slot_status CHECK (status IN ('FREE', 'BOOKED', 'BLOCKED')),
    CONSTRAINT uq_slot_doctor_start UNIQUE (doctor_id, slot_start),
    CONSTRAINT fk_slot_doctor FOREIGN KEY (doctor_id)
        REFERENCES doctor (doctor_id) ON DELETE CASCADE,
    -- Rule R2: EXCLUDE constraint preventing overlapping slots for the same doctor
    CONSTRAINT excl_doctor_slot_overlap EXCLUDE USING gist (
        doctor_id WITH =,
        tstzrange(slot_start, slot_end) WITH &&
    )
);

-- ----------------------------------------------------------------------------
-- 8. appointment
-- Partial unique index on slot_id where status <> 'CANCELLED' ensures a slot
-- can never have more than one live booking while allowing cancelled slots
-- to be re-booked without losing history.
-- ----------------------------------------------------------------------------
CREATE TABLE appointment (
    appt_id      SERIAL PRIMARY KEY,
    patient_id   INT NOT NULL,
    slot_id      INT NOT NULL,
    status       VARCHAR(10) NOT NULL DEFAULT 'BOOKED',
    reason       TEXT,
    booked_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMPTZ,

    CONSTRAINT chk_appt_status CHECK (status IN ('BOOKED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
    CONSTRAINT chk_appt_cancelled_at CHECK (
        (status = 'CANCELLED' AND cancelled_at IS NOT NULL) OR
        (status <> 'CANCELLED' AND cancelled_at IS NULL)
    ),
    CONSTRAINT fk_appointment_patient FOREIGN KEY (patient_id)
        REFERENCES patient (patient_id) ON DELETE RESTRICT,
    CONSTRAINT fk_appointment_slot FOREIGN KEY (slot_id)
        REFERENCES slot (slot_id) ON DELETE RESTRICT
);

-- Partial unique index on slot_id for active appointments
CREATE UNIQUE INDEX idx_appointment_slot_active
    ON appointment (slot_id)
    WHERE status <> 'CANCELLED';

-- ----------------------------------------------------------------------------
-- 9. payment (1:1 with appointment)
-- Rule R7 validation support: refund bounds and status sync
-- ----------------------------------------------------------------------------
CREATE TABLE payment (
    payment_id    SERIAL PRIMARY KEY,
    appt_id       INT NOT NULL,
    amount        NUMERIC(10, 2) NOT NULL,
    method        VARCHAR(20) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'PAID',
    refund_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    paid_at       TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_payment_appt UNIQUE (appt_id),
    CONSTRAINT chk_payment_amount CHECK (amount >= 0),
    CONSTRAINT chk_payment_method CHECK (method IN ('UPI', 'CARD', 'NETBANKING', 'CASH')),
    CONSTRAINT chk_payment_status CHECK (status IN ('PAID', 'PARTIAL_REFUND', 'REFUNDED')),
    CONSTRAINT chk_payment_refund_bounds CHECK (refund_amount >= 0 AND refund_amount <= amount),
    CONSTRAINT chk_payment_status_refund_sync CHECK (
        (refund_amount = 0 AND status = 'PAID') OR
        (refund_amount > 0 AND refund_amount < amount AND status = 'PARTIAL_REFUND') OR
        (refund_amount = amount AND amount > 0 AND status = 'REFUNDED') OR
        (amount = 0 AND refund_amount = 0 AND status = 'PAID')
    ),
    CONSTRAINT fk_payment_appointment FOREIGN KEY (appt_id)
        REFERENCES appointment (appt_id) ON DELETE RESTRICT
);

-- ----------------------------------------------------------------------------
-- 10. medicine
-- ----------------------------------------------------------------------------
CREATE TABLE medicine (
    medicine_id SERIAL PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    form        VARCHAR(20) NOT NULL,
    strength    VARCHAR(50) NOT NULL,

    CONSTRAINT chk_medicine_form CHECK (
        form IN ('TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'OINTMENT', 'DROPS', 'OTHER')
    ),
    CONSTRAINT uq_medicine_name_form_strength UNIQUE (name, form, strength)
);

-- ----------------------------------------------------------------------------
-- 11. prescription_item (Prescribes relationship, composite PK)
-- ----------------------------------------------------------------------------
CREATE TABLE prescription_item (
    appt_id     INT NOT NULL,
    medicine_id INT NOT NULL,
    dosage      VARCHAR(100) NOT NULL,
    days_supply INT NOT NULL,

    CONSTRAINT pk_prescription_item PRIMARY KEY (appt_id, medicine_id),
    CONSTRAINT chk_prescription_days_supply CHECK (days_supply BETWEEN 1 AND 365),
    CONSTRAINT fk_prescription_appointment FOREIGN KEY (appt_id)
        REFERENCES appointment (appt_id) ON DELETE CASCADE,
    CONSTRAINT fk_prescription_medicine FOREIGN KEY (medicine_id)
        REFERENCES medicine (medicine_id) ON DELETE RESTRICT
);

-- ----------------------------------------------------------------------------
-- 12. review (1:1 with appointment)
-- ----------------------------------------------------------------------------
CREATE TABLE review (
    review_id  SERIAL PRIMARY KEY,
    appt_id    INT NOT NULL,
    rating     INT NOT NULL,
    comment    TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_review_appt UNIQUE (appt_id),
    CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),
    CONSTRAINT fk_review_appointment FOREIGN KEY (appt_id)
        REFERENCES appointment (appt_id) ON DELETE CASCADE
);
