-- ============================================================================
-- MediSlot: Doctor Appointment Booking System
-- Group 6 | Aditya Singh (2024A8PS0491H)
-- File: db/02_schedule.sql
-- Description: Triggers and procedures for doctor scheduling:
--              1. Availability overlap & divisibility trigger (Rule R4)
--              2. Appointment status lifecycle trigger (Rule R5)
--              3. Slot generation function (sp_generate_slots)
-- Adheres strictly to the project rules and error prefix contract ('R<n>:').
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Rule R4: Availability Overlap and Divisibility Trigger
-- A doctor's weekly windows cannot overlap and must be divided into whole slots.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_check_availability_overlap()
RETURNS TRIGGER AS $$
BEGIN
    -- Divisibility check (R4): Window length must be divisible by slot_minutes
    IF ((EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time))::INT / 60) % NEW.slot_minutes) <> 0 THEN
        RAISE EXCEPTION 'R4: Availability window (% to %) is not evenly divisible into %-minute slots',
            NEW.start_time, NEW.end_time, NEW.slot_minutes;
    END IF;

    -- Overlap check (R4): A doctor cannot have overlapping windows on the same weekday
    IF EXISTS (
        SELECT 1
        FROM availability
        WHERE doctor_id = NEW.doctor_id
          AND weekday = NEW.weekday
          AND (avail_id <> NEW.avail_id OR NEW.avail_id IS NULL)
          AND (NEW.start_time, NEW.end_time) OVERLAPS (start_time, end_time)
    ) THEN
        RAISE EXCEPTION 'R4: Doctor % already has an overlapping availability window on weekday %',
            NEW.doctor_id, NEW.weekday;
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
-- Enforced via BEFORE UPDATE trigger.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_appointment_status_lifecycle()
RETURNS TRIGGER AS $$
BEGIN
    -- If status hasn't changed, allow row update (e.g., updating reason text)
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Once in a terminal state, no further status transition is allowed
    IF OLD.status IN ('COMPLETED', 'NO_SHOW', 'CANCELLED') THEN
        RAISE EXCEPTION 'R5: Appointment in terminal state % cannot transition to %',
            OLD.status, NEW.status;
    END IF;

    -- When starting from BOOKED, allowed transitions are COMPLETED, NO_SHOW, CANCELLED
    IF OLD.status = 'BOOKED' THEN
        IF NEW.status NOT IN ('COMPLETED', 'NO_SHOW', 'CANCELLED') THEN
            RAISE EXCEPTION 'R5: Invalid appointment status transition from % to %',
                OLD.status, NEW.status;
        END IF;

        -- Maintain cancelled_at timestamp synchronization when cancelled
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
    -- Basic validation
    IF p_end_date < p_start_date THEN
        RAISE EXCEPTION 'End date (%) cannot be earlier than start date (%)',
            p_end_date, p_start_date;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM doctor WHERE doctor_id = p_doctor_id) THEN
        RAISE EXCEPTION 'Doctor with ID % does not exist', p_doctor_id;
    END IF;

    -- Loop through each date in the range
    v_curr_date := p_start_date;
    WHILE v_curr_date <= p_end_date LOOP
        -- ISO weekday: 1 = Monday .. 7 = Sunday
        v_iso_dow := EXTRACT(ISODOW FROM v_curr_date)::INT;

        -- Find availability patterns for this doctor and weekday
        FOR v_avail IN
            SELECT start_time, end_time, slot_minutes
            FROM availability
            WHERE doctor_id = p_doctor_id
              AND weekday = v_iso_dow
            ORDER BY start_time ASC
        LOOP
            v_step_mins := v_avail.slot_minutes;
            -- Construct timestamps in Indian Standard Time (IST, UTC+05:30)
            v_window_start := (v_curr_date + v_avail.start_time) AT TIME ZONE 'Asia/Kolkata';
            v_window_end   := (v_curr_date + v_avail.end_time)   AT TIME ZONE 'Asia/Kolkata';

            v_slot_start := v_window_start;
            WHILE v_slot_start < v_window_end LOOP
                v_slot_end := v_slot_start + (v_step_mins || ' minutes')::INTERVAL;

                -- Insert slot if not already present (idempotent slot generation)
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

-- Convenience overload to generate slots for all doctors across a date range
CREATE OR REPLACE FUNCTION sp_generate_all_slots(
    p_start_date DATE,
    p_end_date DATE
)
RETURNS INT AS $$
DECLARE
    v_doc RECORD;
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
