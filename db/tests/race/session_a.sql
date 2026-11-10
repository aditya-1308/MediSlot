-- ============================================================================
-- MediSlot | Mohammad Mubeen Khan | db/tests/race/session_a.sql
-- Two-session race for R1, part A. Run on a seeded database:
--   Tab 1:  psql -d medislot -f db/tests/race/session_a.sql
--   Tab 2:  psql -d medislot -f db/tests/race/session_b.sql   (while tab 1 waits)
-- A books the slot and holds its transaction open. B tries the same slot and
-- blocks on the slot row lock. When A commits, B wakes up, re-reads the row
-- (READ COMMITTED), sees BOOKED and fails with R1. If A rolls back instead,
-- B gets the slot.
-- ============================================================================

-- Target: the earliest free slot at least a day ahead; racer: lowest patient id
SELECT slot_id AS race_slot FROM slot
WHERE status = 'FREE' AND slot_start > now() + INTERVAL '1 day'
ORDER BY slot_id LIMIT 1 \gset
SELECT min(patient_id) AS racer FROM patient \gset

\echo 'Session A: booking slot' :race_slot 'for patient' :racer

BEGIN;
SELECT sp_book_appointment(:racer, :race_slot, 'UPI', 'race demo: session A') AS appt_id;

\echo 'Session A holds the slot lock. Start session_b.sql in another tab now.'
\prompt 'Press Enter to COMMIT session A... ' _wait

COMMIT;
\echo 'Session A committed. Session B should now fail with R1.'
