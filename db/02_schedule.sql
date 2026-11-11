-- ============================================================================
-- MediSlot: Doctor Appointment Booking System
-- Group 6 | Aditya Singh (2024A8PS0491H)
-- File: db/02_schedule.sql
-- Description: Triggers, procedures and views for doctor scheduling:
--              1. Availability overlap & divisibility trigger (Rule R4)
--              2. Appointment status lifecycle trigger (Rule R5)
--              3. Slot generation functions (sp_generate_slots, sp_generate_all_slots)
--              4. Scheduling/visit helper functions & views for routes/doctor.js
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Rule R4: Availability Overlap and Divisibility Trigger
-- A doctor's weekly windows cannot overlap and must be divided into whole slots.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_check_availability_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.weekday NOT BETWEEN 1 AND 7 THEN
        RAISE EXCEPTION 'R4: Weekday (%) must be between 1 and 7',
            NEW.weekday
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.end_time <= NEW.start_time THEN
        RAISE EXCEPTION 'R4: End time (%) must be after start time (%)',
            NEW.end_time, NEW.start_time
            USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.slot_minutes NOT IN (10, 15, 20, 30, 45, 60) THEN
        RAISE EXCEPTION 'R4: Slot length (%) must be 10, 15, 20, 30, 45 or 60 minutes',
            NEW.slot_minutes
            USING ERRCODE = 'check_violation';
    END IF;

    -- Window duration in seconds must be an exact multiple of slot_minutes
    IF (EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) % (NEW.slot_minutes * 60)) <> 0 THEN
        RAISE EXCEPTION 'R4: Availability window (% to %) is not evenly divisible into %-minute slots',
            NEW.start_time, NEW.end_time, NEW.slot_minutes
            USING ERRCODE = 'check_violation';
    END IF;

    -- Overlap check: same doctor, same ISO weekday
    IF EXISTS (
        SELECT 1
        FROM availability
        WHERE doctor_id = NEW.doctor_id
          AND weekday = NEW.weekday
          AND (avail_id <> NEW.avail_id OR NEW.avail_id IS NULL)
          AND (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
    ) THEN
        RAISE EXCEPTION 'R4: Doctor % already has an overlapping availability window on weekday %',
            NEW.doctor_id, NEW.weekday
            USING ERRCODE = 'exclusion_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_availability_overlap ON availability;
CREATE TRIGGER trg_check_availability_overlap
    BEFORE INSERT OR UPDATE ON availability
    FOR EACH ROW
    EXECUTE FUNCTION fn_check_availability_overlap();

-- ----------------------------------------------------------------------------
-- 2. Rule R5: Appointment Status Lifecycle Trigger
-- An appointment goes from BOOKED to COMPLETED, NO_SHOW or CANCELLED, and stops there.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_appointment_status_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    IF OLD.status IN ('COMPLETED', 'NO_SHOW', 'CANCELLED') THEN
        RAISE EXCEPTION 'R5: Appointment in terminal state % cannot transition to %',
            OLD.status, NEW.status
            USING ERRCODE = 'check_violation';
    END IF;

    IF OLD.status = 'BOOKED' THEN
        IF NEW.status NOT IN ('COMPLETED', 'NO_SHOW', 'CANCELLED') THEN
            RAISE EXCEPTION 'R5: Invalid appointment status transition from % to %',
                OLD.status, NEW.status
                USING ERRCODE = 'check_violation';
        END IF;

        IF NEW.status = 'CANCELLED' AND NEW.cancelled_at IS NULL THEN
            NEW.cancelled_at := CURRENT_TIMESTAMP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appointment_status_lifecycle ON appointment;
CREATE TRIGGER trg_appointment_status_lifecycle
    BEFORE UPDATE ON appointment
    FOR EACH ROW
    EXECUTE FUNCTION fn_appointment_status_lifecycle();

-- ----------------------------------------------------------------------------
-- 3. sp_generate_slots: Generates concrete slot records from weekly availability
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_generate_slots(
    p_doctor_id INT,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS INT AS $$
DECLARE
    v_curr_date    DATE;
    v_iso_dow      INT;
    v_avail        RECORD;
    v_slot_start   TIMESTAMPTZ;
    v_slot_end     TIMESTAMPTZ;
    v_step_mins    INT;
    v_window_start TIMESTAMPTZ;
    v_window_end   TIMESTAMPTZ;
    v_slots_count  INT := 0;
BEGIN
    IF p_end_date < p_start_date THEN
        RAISE EXCEPTION 'R4: End date (%) cannot be earlier than start date (%)',
            p_end_date, p_start_date
            USING ERRCODE = 'check_violation';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM doctor WHERE doctor_id = p_doctor_id) THEN
        RAISE EXCEPTION 'Doctor with ID % does not exist', p_doctor_id
            USING ERRCODE = 'no_data_found';
    END IF;

    v_curr_date := p_start_date;
    WHILE v_curr_date <= p_end_date LOOP
        v_iso_dow := EXTRACT(ISODOW FROM v_curr_date)::INT;

        FOR v_avail IN
            SELECT start_time, end_time, slot_minutes
            FROM availability
            WHERE doctor_id = p_doctor_id
              AND weekday = v_iso_dow
            ORDER BY start_time ASC
        LOOP
            v_step_mins := v_avail.slot_minutes;
            v_window_start := (v_curr_date + v_avail.start_time) AT TIME ZONE 'Asia/Kolkata';
            v_window_end   := (v_curr_date + v_avail.end_time)   AT TIME ZONE 'Asia/Kolkata';

            v_slot_start := v_window_start;
            WHILE v_slot_start < v_window_end LOOP
                v_slot_end := v_slot_start + (v_step_mins || ' minutes')::INTERVAL;

                INSERT INTO slot (doctor_id, slot_start, slot_end, status)
                VALUES (p_doctor_id, v_slot_start, v_slot_end, 'FREE')
                ON CONFLICT (doctor_id, slot_start) DO NOTHING;

                IF FOUND THEN
                    v_slots_count := v_slots_count + 1;
                END IF;

                v_slot_start := v_slot_end;
            END LOOP;
        END LOOP;

        v_curr_date := v_curr_date + 1;
    END LOOP;

    RETURN v_slots_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_generate_all_slots(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS INT AS $$
DECLARE
    v_doc   RECORD;
    v_total INT := 0;
    v_count INT;
BEGIN
    FOR v_doc IN SELECT doctor_id FROM doctor ORDER BY doctor_id LOOP
        SELECT sp_generate_slots(v_doc.doctor_id, p_start_date, p_end_date) INTO v_count;
        v_total := v_total + v_count;
    END LOOP;
    RETURN v_total;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 4. Doctor API helper functions (used by server/routes/doctor.js)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_add_availability(
    p_doctor_id    INT,
    p_weekday      INT,
    p_start_time   TIME,
    p_end_time     TIME,
    p_slot_minutes INT
)
RETURNS availability AS $$
DECLARE
    v_row availability%ROWTYPE;
BEGIN
    INSERT INTO availability (doctor_id, weekday, start_time, end_time, slot_minutes)
    VALUES (p_doctor_id, p_weekday, p_start_time, p_end_time, p_slot_minutes)
    RETURNING * INTO v_row;

    RETURN v_row;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_delete_availability(
    p_doctor_id INT,
    p_avail_id  INT
)
RETURNS BOOLEAN AS $$
BEGIN
    DELETE FROM availability
    WHERE avail_id = p_avail_id
      AND doctor_id = p_doctor_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Availability window % not found', p_avail_id
            USING ERRCODE = 'no_data_found';
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Doctor marks a BOOKED visit as COMPLETED or NO_SHOW (Rule R5 applies on UPDATE)
CREATE OR REPLACE FUNCTION sp_set_appointment_status(
    p_doctor_id  INT,
    p_appt_id    INT,
    p_new_status VARCHAR
)
RETURNS appointment AS $$
DECLARE
    v_owner_id    INT;
    v_curr_status VARCHAR;
    v_appt        appointment%ROWTYPE;
BEGIN
    SELECT s.doctor_id, a.status INTO v_owner_id, v_curr_status
    FROM appointment a
    JOIN slot s ON s.slot_id = a.slot_id
    WHERE a.appt_id = p_appt_id
    FOR UPDATE OF a;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appointment % does not exist', p_appt_id
            USING ERRCODE = 'no_data_found';
    END IF;

    IF v_owner_id <> p_doctor_id THEN
        RAISE EXCEPTION 'Appointment % does not belong to doctor %', p_appt_id, p_doctor_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_new_status NOT IN ('COMPLETED', 'NO_SHOW') THEN
        RAISE EXCEPTION 'R5: Doctors can only mark appointments COMPLETED or NO_SHOW'
            USING ERRCODE = 'check_violation';
    END IF;

    IF v_curr_status <> 'BOOKED' THEN
        RAISE EXCEPTION 'R5: Appointment % is in % state and cannot transition to %',
            p_appt_id, v_curr_status, p_new_status
            USING ERRCODE = 'check_violation';
    END IF;

    UPDATE appointment
    SET status = p_new_status
    WHERE appt_id = p_appt_id
    RETURNING * INTO v_appt;

    RETURN v_appt;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION sp_toggle_slot_block(
    p_doctor_id INT,
    p_slot_id   INT,
    p_block     BOOLEAN
)
RETURNS slot AS $$
DECLARE
    v_slot slot%ROWTYPE;
BEGIN
    SELECT * INTO v_slot FROM slot WHERE slot_id = p_slot_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Slot % does not exist', p_slot_id
            USING ERRCODE = 'no_data_found';
    END IF;

    IF v_slot.doctor_id <> p_doctor_id THEN
        RAISE EXCEPTION 'Slot % does not belong to doctor %', p_slot_id, p_doctor_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_slot.status = 'BOOKED' THEN
        RAISE EXCEPTION 'R5: Slot % already has an active booking and cannot be blocked', p_slot_id
            USING ERRCODE = 'check_violation';
    END IF;

    UPDATE slot
    SET status = CASE WHEN p_block THEN 'BLOCKED' ELSE 'FREE' END
    WHERE slot_id = p_slot_id
    RETURNING * INTO v_slot;

    RETURN v_slot;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5. Views used by server/routes/doctor.js
-- ----------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_doctor_profile AS
SELECT d.doctor_id,
       u.full_name,
       u.email,
       u.phone,
       d.license_no,
       d.fee,
       d.experience_yrs,
       sp.name     AS specialty,
       c.name      AS clinic_name,
       c.address   AS clinic_address,
       c.city
FROM doctor d
JOIN app_user u   ON u.user_id = d.doctor_id
JOIN specialty sp ON sp.specialty_id = d.specialty_id
JOIN clinic c     ON c.clinic_id = d.clinic_id;

CREATE OR REPLACE VIEW v_doctor_appointments AS
SELECT a.appt_id,
       a.status,
       a.reason,
       a.booked_at,
       a.cancelled_at,
       s.slot_id,
       s.doctor_id,
       s.slot_start,
       s.slot_end,
       (s.slot_start AT TIME ZONE 'Asia/Kolkata')::date AS visit_date,
       p.patient_id,
       pu.full_name AS patient_name,
       pu.phone     AS patient_phone,
       p.dob        AS patient_dob,
       p.gender     AS patient_gender,
       EXISTS (
           SELECT 1
           FROM prescription_item pi
           WHERE pi.appt_id = a.appt_id
       ) AS has_prescription
FROM appointment a
JOIN slot s      ON s.slot_id = a.slot_id
JOIN patient p   ON p.patient_id = a.patient_id
JOIN app_user pu ON pu.user_id = p.patient_id;
