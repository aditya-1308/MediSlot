# Seed Data, Indexing, and Doctor Search (Potta Avinash, 2024A8PS0473H)

**Rules owned / focus:** Realistic dataset generation, query optimisation via B-tree and partial indexes, doctor discovery and search workflows.  
**Files:** `db/seed.sql`, `db/06_indexes.sql`, `queries/q7_next_free_slots.sql`, `db/explain/`, `server/routes/search.js`, `client/src/pages/search/`

**Transaction-consistent seed data.** Rather than executing disconnected `INSERT` statements that leave redundant columns or payment states inconsistent, `db/seed.sql` populates the database using the production stored procedures. Under `SET medislot.seeding = 'on'` (which relaxes current-time validation R9 while preserving slot uniqueness R1, patient concurrency R3, and refund formulas R7), 30 doctors, 120 patients, 400 appointments, and over 2,000 slots across 6 clinics and 12 specialties were seeded. Appointments and payments transition through `sp_book_appointment` and `sp_cancel_appointment` with historical timestamps, populating realistic payment refund amounts, prescription items, and reviews.

**Performance indexes and EXPLAIN analysis.** `db/06_indexes.sql` creates targeted composite and partial indexes based on query plan bottlenecks:
1. `idx_slot_doctor_start_status`: partial index on `slot (doctor_id, slot_start) WHERE status = 'FREE'`, accelerating free slot lookups and Q7.
2. `idx_doctor_specialty_clinic`: composite index on `doctor (specialty_id, clinic_id)` for search joins.
3. `idx_clinic_city`: B-tree index on `clinic (city)` for city-level filtering.
4. `idx_appointment_patient`: index on `appointment (patient_id, status)` for patient appointment history.
5. `idx_payment_appt`: index on `payment (appt_id)` for revenue joins.

**Window function query (Q7).** `queries/q7_next_free_slots.sql` retrieves the next three free slots for each doctor within a target city using `ROW_NUMBER() OVER (PARTITION BY s.doctor_id ORDER BY s.slot_start)`. In `db/explain/`, the before/after execution plans demonstrate that the partial index replaces a sequential filter scan over the entire `slot` table with an index-only scan, substantially reducing buffer reads and query execution time.

**Doctor search API and interface.** `server/routes/search.js` exposes `/api/search/doctors`, `/api/search/specialties`, and `/api/search/cities`. It queries `v_slot_details` and `v_doctor_appointments` with dynamic multi-parameter filtering (specialty, city, doctor name, and date). The search UI (`client/src/pages/search/`) enables patients to browse verified doctors, view clinic locations and consultation fees, and transition seamlessly into slot booking.
