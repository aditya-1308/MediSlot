# Clinical Records, Rule 6 Enforcement & QA (Suryanath A, 2024A8PS0471H)

**Rules owned / focus:** Rule 6 (reviews and prescriptions strictly restricted to completed visits), clinical records workflow, automated test suites and end-to-end QA.  
**Files:** `db/04_clinical.sql`, `db/tests/test_clinical.sql`, `server/routes/clinical.js`, `client/src/pages/clinical/`

**Database-level enforcement of Rule 6.** Medical prescriptions and patient reviews must only be recorded after a consultation has physically taken place. In `db/04_clinical.sql`, this invariant is enforced directly inside PostgreSQL rather than relying on application-level validations. The function `fn_check_completed_appointment()` verifies that `appointment.status = 'COMPLETED'` for `NEW.appt_id`. If the appointment is in `BOOKED`, `CANCELLED`, or `NO_SHOW` status, the trigger terminates the transaction with `RAISE EXCEPTION 'R6: Prescriptions and reviews are only allowed for completed appointments'`. Two `BEFORE INSERT OR UPDATE` triggers bind this logic:
- `trg_enforce_r6_prescription` on table `prescription_item`
- `trg_enforce_r6_review` on table `review`

Both triggers feature idempotent DDL (`DROP TRIGGER IF EXISTS`) ensuring safe execution during automated testing and database migrations.

**Clinical test suite and validation.** `db/tests/test_clinical.sql` is structured inside an isolated transaction block (`BEGIN ... ROLLBACK`) with `\set ON_ERROR_STOP on`. It sets up test appointments across `BOOKED` and `COMPLETED` states, verifying both positive and negative cases:
1. *Positive checks:* Inserting prescription items and patient reviews for completed visits commits without error.
2. *Negative checks:* Inserting prescription items or reviews for active `BOOKED` appointments raises the expected `R6` exception, caught and verified within explicit PL/pgSQL `DO $$ ... EXCEPTION $$` testing blocks.

**Clinical API and user experience.** `server/routes/clinical.js` provides authenticated access to clinical records:
- `GET /api/clinical/medicines`: Unauthenticated catalogue access for dosage selection.
- `GET /api/clinical/visits/:apptId/prescription`: Accessible by both the consulting doctor and the appointment's patient.
- `POST/DELETE /api/clinical/visits/:apptId/prescription`: Restricts prescription item creation and deletion strictly to the treating doctor.
- `POST /api/clinical/visits/:apptId/review`: Allows the verified patient to record a rating (1 to 5) and feedback comment.

The interface (`client/src/pages/clinical/Prescription.jsx`) renders a role-aware view: doctors manage dosage and days supply with real-time removal, while patients review their prescribed medications and submit doctor reviews.
