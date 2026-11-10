# Booking transaction and app core (Mohammad Mubeen Khan, 2024A8PS0489H)

**Rules owned:** R1 (no double booking), R3 (no patient clash), R7 (refund tiers), R9 (no booking after start).
**Files:** `db/03_booking.sql`, `db/tests/test_booking.sql`, `db/tests/race/`, `server/` core, `server/routes/booking.js`, client shell and `client/src/pages/booking/`.

**Booking as one transaction.** `sp_book_appointment(patient, slot, method, reason)` locks the slot row (`SELECT ... FOR UPDATE`), checks R9 (a CHECK cannot read the current time, so this lives in the function), checks the slot is FREE, inserts the appointment and then the payment with the doctor's fee snapshot. Any failure, such as a bad payment method, rolls back the whole call, so a slot is never left booked without a payment. `sp_cancel_appointment` locks the appointment, computes the refund with `fn_refund_amount` (100% at 24 h or more, 50% from 2 to 24 h, 0 under 2 h, inclusive at the edges), cancels the appointment and sets the payment's `refund_amount` and status together, so `chk_payment_status_refund_sync` always holds.

**Triggers.** A BEFORE INSERT trigger on `appointment` re-checks R1 and R3 for every insert, so a direct `INSERT` gets the same guarantees as the function. An AFTER trigger keeps the redundant `slot.status` in step: a live booking sets the slot to BOOKED, and cancelling sets it back to FREE so it can be re-booked. The partial unique index stays as the last line of defence.

**Why READ COMMITTED is enough.** For two patients racing for one slot, the second blocks on the row lock. When the first commits, READ COMMITTED re-reads the locked row, sees BOOKED and raises R1. For one patient booking two overlapping slots, there is no existing row to lock, so every insert first takes `pg_advisory_xact_lock(4801, patient_id)`. One patient's bookings then run one at a time, and each statement's fresh snapshot sees the other booking once it has committed. Both functions take the locks in the same order (patient, then slot), so they cannot deadlock. SERIALIZABLE would also work, but it would turn races into retry errors that the app would have to handle.

**Seeding past visits.** Past COMPLETED visits break R9. `SET medislot.seeding = 'on'` skips R9 only and lets the functions take a historical `p_at` timestamp, so seeded cancellations land in realistic refund tiers. Every other rule still applies.

**App core.** Express with a `pg` pool, JWT and bcrypt. Signup writes `app_user` and `patient` in one transaction. `requireRole()` guards routes, and `errors.js` maps `R<n>:` prefixes and SQLSTATEs to HTTP codes and readable messages, so the UI shows the database's own reason. Route files and page folders are auto-mounted, so teammates never edit the core.

**Tests.** `test_booking.sql` runs 27 checks covering R1, R3, R7 at the 24 h and 2 h edges, R9, atomicity, the seeding bypass and the views. `db/tests/race/` is the two-tab race demo.
