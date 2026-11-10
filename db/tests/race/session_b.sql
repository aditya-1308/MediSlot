-- ============================================================================
-- MediSlot | Mohammad Mubeen Khan | db/tests/race/session_b.sql
-- Two-session race for R1, part B. Start after session_a.sql is waiting.
-- A's booking is not committed yet, so this session still sees the slot as
-- FREE and picks the same one. The call blocks on the FOR UPDATE row lock
-- until A commits, then fails with:
--   ERROR:  R1: Slot <id> is not available (status BOOKED)
-- ============================================================================

SELECT slot_id AS race_slot FROM slot
WHERE status = 'FREE' AND slot_start > now() + INTERVAL '1 day'
ORDER BY slot_id LIMIT 1 \gset
SELECT patient_id AS racer FROM patient ORDER BY patient_id OFFSET 1 LIMIT 1 \gset

\echo 'Session B: booking slot' :race_slot 'for patient' :racer '(this will wait for session A)'

SELECT sp_book_appointment(:racer, :race_slot, 'CARD', 'race demo: session B') AS appt_id;
