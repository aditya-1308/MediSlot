-- ============================================================================
-- MediSlot: Doctor Appointment Booking System
-- Group 6 | Mohammad Mubeen Khan (2024A8PS0489H)
-- File: db/03_booking.sql
-- Description: Booking transaction and cancellation:
--              1. fn_refund_amount            refund tiers (Rule R7)
--              2. Appointment BEFORE INSERT   slot must be free (R1), no patient clash (R3)
--              3. Slot-status sync trigger    keeps slot.status in step with appointments
--              4. sp_book_appointment         lock, check R9, insert appointment + payment
--              5. sp_cancel_appointment       lock, compute refund, cancel, update payment
--              6. Views used by the booking API
-- Errors follow the 'R<n>: <message>' contract that server/errors.js maps.
--
-- Concurrency (why READ COMMITTED plus these locks is enough):
--   * Same slot, two patients: sp_book_appointment takes the slot row with
--     SELECT ... FOR UPDATE. The second caller blocks until the first commits,
--     then READ COMMITTED re-reads the locked row and sees status = 'BOOKED',
--     so it is rejected with R1. The partial unique index on appointment(slot_id)
--     is the last line of defence if anything bypasses the function.
--   * Same patient, two slots: R3 has to look for rows that may not exist yet,
--     and a row lock cannot lock a row that is not there. So every insert for a
--     patient first takes a transaction-scoped advisory lock keyed on the
--     patient id. Bookings for one patient run one at a time, and because each
--     statement in READ COMMITTED takes a fresh snapshot, the R3 check that runs
--     after the lock is granted sees the other booking once it has committed.
--   * Lock order is always patient advisory lock -> slot row, in both booking
--     and cancellation, so the two cannot deadlock each other.
--
-- Seeding (hand-off with Avinash): seed.sql runs
--     SET medislot.seeding = 'on';
-- which lets sp_book_appointment book slots in the past (skips R9) and lets
-- both functions take an explicit p_at timestamp so historical bookings and
-- cancellations get realistic times and refund tiers. All other rules,
-- triggers and constraints still apply while seeding.
-- ============================================================================

-- Key space for pg_advisory_xact_lock(int, int): (LOCK_NS_PATIENT, patient_id)
-- 4801 is arbitrary; it only has to differ from any other advisory lock user.

-- ----------------------------------------------------------------------------
-- 0. Helper: is the seeding bypass switched on for this session?
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_is_seeding()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(current_setting('medislot.seeding', TRUE), 'off') = 'on';
END;
$$ LANGUAGE plpgsql STABLE;

-- ----------------------------------------------------------------------------
-- 1. Rule R7: refund tiers
-- 100% if cancelled 24 h or more before the slot, 50% from 2 h up to 24 h,
-- nothing under 2 h. Boundaries are inclusive on the generous side:
-- exactly 24 h -> 100%, exactly 2 h -> 50%.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_refund_amount(
    p_amount     NUMERIC,
    p_slot_start TIMESTAMPTZ,
    p_cancel_at  TIMESTAMPTZ
)
RETURNS NUMERIC AS $$
DECLARE
    v_notice INTERVAL := p_slot_start - p_cancel_at;
BEGIN
    IF v_notice >= INTERVAL '24 hours' THEN
        RETURN p_amount;
    ELSIF v_notice >= INTERVAL '2 hours' THEN
        RETURN ROUND(p_amount * 0.5, 2);
    ELSE
        RETURN 0.00;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ----------------------------------------------------------------------------
-- 2. Rules R1 and R3: appointment BEFORE INSERT trigger
-- Runs for every insert, so direct INSERTs (tests, scripts) get the same
-- guarantees as sp_book_appointment.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_appointment_before_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_slot slot%ROWTYPE;
BEGIN
    -- Cancelled rows hold nothing, so they need no checks
    IF NEW.status = 'CANCELLED' THEN
        RETURN NEW;
    END IF;

    -- Serialise all bookings of this patient (re-entrant inside sp_book_appointment)
    PERFORM pg_advisory_xact_lock(4801, NEW.patient_id);

    SELECT * INTO v_slot FROM slot WHERE slot_id = NEW.slot_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'R1: Slot % does not exist', NEW.slot_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- R1: the slot must be free. Raised as unique_violation because it is the
    -- same fact the partial unique index protects: one live booking per slot.
    IF v_slot.status <> 'FREE' THEN
        RAISE EXCEPTION 'R1: Slot % is not available (status %)', NEW.slot_id, v_slot.status
            USING ERRCODE = 'unique_violation';
    END IF;

    -- R3: the patient must not already hold an overlapping live appointment.
    -- Ranges are half-open, so back-to-back slots (10:00-10:30, 10:30-11:00) are fine.
    IF EXISTS (
        SELECT 1
        FROM appointment a
        JOIN slot s ON s.slot_id = a.slot_id
        WHERE a.patient_id = NEW.patient_id
          AND a.status <> 'CANCELLED'
          AND tstzrange(s.slot_start, s.slot_end) && tstzrange(v_slot.slot_start, v_slot.slot_end)
    ) THEN
        RAISE EXCEPTION 'R3: Patient % already has an appointment overlapping % to %',
            NEW.patient_id, v_slot.slot_start, v_slot.slot_end
            USING ERRCODE = 'exclusion_violation';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appointment_before_insert ON appointment;
CREATE TRIGGER trg_appointment_before_insert
    BEFORE INSERT ON appointment
    FOR EACH ROW
    EXECUTE FUNCTION fn_appointment_before_insert();

-- ----------------------------------------------------------------------------
-- 3. Slot-status sync trigger
-- slot.status is deliberate redundancy (design decision 4). It is only ever
-- changed here, in the same transaction as the appointment change:
--   live appointment inserted       -> slot BOOKED
--   appointment moved to CANCELLED  -> slot FREE again (can be re-booked)
-- COMPLETED and NO_SHOW keep the slot BOOKED: the time was used.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_sync_slot_status()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'CANCELLED' THEN
            UPDATE slot SET status = 'BOOKED' WHERE slot_id = NEW.slot_id;
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        IF NEW.status = 'CANCELLED' AND OLD.status <> 'CANCELLED' THEN
            UPDATE slot SET status = 'FREE'
            WHERE slot_id = NEW.slot_id AND status = 'BOOKED';
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_slot_status ON appointment;
CREATE TRIGGER trg_sync_slot_status
    AFTER INSERT OR UPDATE OF status ON appointment
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_slot_status();

-- ----------------------------------------------------------------------------
-- 4. sp_book_appointment: the booking transaction (workflow W1)
-- Books the slot and records the simulated payment in one transaction.
-- If any step fails, the whole call rolls back and the slot stays FREE.
-- Returns the new appt_id.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_book_appointment(
    p_patient_id INT,
    p_slot_id    INT,
    p_method     VARCHAR,
    p_reason     TEXT DEFAULT NULL,
    p_at         TIMESTAMPTZ DEFAULT NULL   -- honoured only while seeding
)
RETURNS INT AS $$
DECLARE
    v_now     TIMESTAMPTZ := now();
    v_slot    slot%ROWTYPE;
    v_fee     NUMERIC(10, 2);
    v_appt_id INT;
BEGIN
    IF p_at IS NOT NULL THEN
        IF NOT fn_is_seeding() THEN
            RAISE EXCEPTION 'p_at may only be passed while medislot.seeding is on';
        END IF;
        v_now := p_at;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM patient WHERE patient_id = p_patient_id) THEN
        RAISE EXCEPTION 'R8: User % is not a patient', p_patient_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- Lock order: patient first, then slot (same as sp_cancel_appointment)
    PERFORM pg_advisory_xact_lock(4801, p_patient_id);

    SELECT * INTO v_slot FROM slot WHERE slot_id = p_slot_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'R1: Slot % does not exist', p_slot_id
            USING ERRCODE = 'foreign_key_violation';
    END IF;

    -- R9: a slot that has already started cannot be booked.
    -- A CHECK cannot do this because it may not use the current time.
    IF v_slot.slot_start <= v_now AND NOT fn_is_seeding() THEN
        RAISE EXCEPTION 'R9: Slot % started at % and can no longer be booked',
            p_slot_id, v_slot.slot_start
            USING ERRCODE = 'check_violation';
    END IF;

    IF v_slot.status <> 'FREE' THEN
        RAISE EXCEPTION 'R1: Slot % is not available (status %)', p_slot_id, v_slot.status
            USING ERRCODE = 'unique_violation';
    END IF;

    -- R3 is checked by trg_appointment_before_insert; slot becomes BOOKED via trg_sync_slot_status
    INSERT INTO appointment (patient_id, slot_id, status, reason, booked_at)
    VALUES (p_patient_id, p_slot_id, 'BOOKED', p_reason, v_now)
    RETURNING appt_id INTO v_appt_id;

    -- Snapshot the doctor's current fee (design decision 5)
    SELECT fee INTO v_fee FROM doctor WHERE doctor_id = v_slot.doctor_id;

    INSERT INTO payment (appt_id, amount, method, status, refund_amount, paid_at)
    VALUES (v_appt_id, v_fee, p_method, 'PAID', 0.00, v_now);

    RETURN v_appt_id;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 5. sp_cancel_appointment: cancellation with refund (Rule R7)
-- p_patient_id, when given, must own the appointment (the API always passes it).
-- Returns the refund amount.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sp_cancel_appointment(
    p_appt_id    INT,
    p_patient_id INT DEFAULT NULL,
    p_at         TIMESTAMPTZ DEFAULT NULL   -- honoured only while seeding
)
RETURNS NUMERIC AS $$
DECLARE
    v_now        TIMESTAMPTZ := now();
    v_appt       appointment%ROWTYPE;
    v_slot_start TIMESTAMPTZ;
    v_amount     NUMERIC(10, 2);
    v_refund     NUMERIC(10, 2);
BEGIN
    IF p_at IS NOT NULL THEN
        IF NOT fn_is_seeding() THEN
            RAISE EXCEPTION 'p_at may only be passed while medislot.seeding is on';
        END IF;
        v_now := p_at;
    END IF;

    -- Read the owner without locking, take the patient lock, then lock the row
    SELECT patient_id INTO v_appt.patient_id FROM appointment WHERE appt_id = p_appt_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'R7: Appointment % does not exist', p_appt_id
            USING ERRCODE = 'no_data_found';
    END IF;
    IF p_patient_id IS NOT NULL AND v_appt.patient_id <> p_patient_id THEN
        RAISE EXCEPTION 'R7: Appointment % does not belong to patient %', p_appt_id, p_patient_id
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    PERFORM pg_advisory_xact_lock(4801, v_appt.patient_id);

    SELECT * INTO v_appt FROM appointment WHERE appt_id = p_appt_id FOR UPDATE;

    IF v_appt.status <> 'BOOKED' THEN
        RAISE EXCEPTION 'R5: Appointment % is % and cannot be cancelled', p_appt_id, v_appt.status
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT slot_start INTO v_slot_start FROM slot WHERE slot_id = v_appt.slot_id FOR UPDATE;

    IF v_slot_start <= v_now THEN
        RAISE EXCEPTION 'R7: Appointment % has already started and cannot be cancelled', p_appt_id
            USING ERRCODE = 'check_violation';
    END IF;

    SELECT amount INTO v_amount FROM payment WHERE appt_id = p_appt_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'R7: Appointment % has no payment record', p_appt_id;
    END IF;

    v_refund := fn_refund_amount(v_amount, v_slot_start, v_now);

    -- R5 trigger validates BOOKED -> CANCELLED; sync trigger frees the slot
    UPDATE appointment
    SET status = 'CANCELLED', cancelled_at = v_now
    WHERE appt_id = p_appt_id;

    -- Payment status must agree with the refund (chk_payment_status_refund_sync)
    UPDATE payment
    SET refund_amount = v_refund,
        status = CASE
                     WHEN v_refund = 0 THEN 'PAID'
                     WHEN v_refund = amount THEN 'REFUNDED'
                     ELSE 'PARTIAL_REFUND'
                 END
    WHERE appt_id = p_appt_id;

    RETURN v_refund;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 6. Views used by routes/booking.js
-- ----------------------------------------------------------------------------

-- One row per slot with everything the booking page shows before payment
CREATE OR REPLACE VIEW v_slot_details AS
SELECT s.slot_id,
       s.slot_start,
       s.slot_end,
       s.status,
       d.doctor_id,
       u.full_name      AS doctor_name,
       sp.name          AS specialty,
       c.clinic_id,
       c.name           AS clinic_name,
       c.address        AS clinic_address,
       c.city,
       d.fee,
       d.experience_yrs
FROM slot s
JOIN doctor d     ON d.doctor_id = s.doctor_id
JOIN app_user u   ON u.user_id = d.doctor_id
JOIN specialty sp ON sp.specialty_id = d.specialty_id
JOIN clinic c     ON c.clinic_id = d.clinic_id;

-- A patient's appointments with payment state and what cancelling now would refund
CREATE OR REPLACE VIEW v_patient_appointments AS
SELECT a.appt_id,
       a.patient_id,
       a.status,
       a.reason,
       a.booked_at,
       a.cancelled_at,
       sd.slot_id,
       sd.slot_start,
       sd.slot_end,
       sd.doctor_name,
       sd.specialty,
       sd.clinic_name,
       sd.city,
       p.amount,
       p.method,
       p.status         AS payment_status,
       p.refund_amount,
       CASE
           WHEN a.status = 'BOOKED' AND sd.slot_start > now()
           THEN fn_refund_amount(p.amount, sd.slot_start, now())
       END              AS refund_if_cancelled_now
FROM appointment a
JOIN v_slot_details sd ON sd.slot_id = a.slot_id
LEFT JOIN payment p    ON p.appt_id = a.appt_id;
