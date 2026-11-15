# MediSlot: Doctor Appointment Booking System

**CS F212 Database Systems | BITS Pilani, Hyderabad Campus | Group-6**

![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-Vite-61DAFB?logo=react&logoColor=black)
![Tests](https://img.shields.io/badge/SQL%20tests-67%2B%20assertions-brightgreen)

MediSlot is a web app where patients search for a doctor by specialty and city, pick a free slot, book it and pay. Doctors set a weekly schedule, see the day's patient list, mark visits done or missed and write prescriptions. An admin manages clinics, specialties and medicines, and watches reports on how busy each doctor is and where the money goes. The rules that matter most (no double booking, no overlapping appointments, refunds that match the payment, reviews only for visits that happened) are enforced by PostgreSQL through constraints, triggers and functions, so they hold no matter which client touches the data.

## Contents

1. [Team and contributions](#team-and-contributions)
2. [Current progress](#current-progress)
3. [Users, roles and assumptions](#users-roles-and-assumptions)
4. [Rules the database enforces on its own](#rules-the-database-enforces-on-its-own)
5. [Lifecycles](#lifecycles)
6. [ER modelling](#er-modelling)
7. [Relational schema](#relational-schema)
8. [Architecture and technology stack](#architecture-and-technology-stack)
9. [Workflows implemented](#workflows-implemented)
10. [DBMS features](#dbms-features)
11. [Analytical SQL queries (Q1 to Q7)](#analytical-sql-queries-q1-to-q7)
12. [Performance and indexing](#performance-and-indexing)
13. [Seed dataset](#seed-dataset)
14. [Test suite and automated runner](#test-suite-and-automated-runner)
15. [Repository layout](#repository-layout)
16. [Setup](#setup)
17. [Demo walkthrough](#demo-walkthrough)
18. [Extending the project](#extending-the-project)
19. [Known limitations](#known-limitations)
20. [Individual contribution reports](#individual-contribution-reports)

---

## Team and contributions

| Member | Roll number | Contribution |
| --- | --- | --- |
| Mohammad Mubeen Khan | 2024A8PS0489H | Booking transaction and app core: `sp_book_appointment`, `sp_cancel_appointment`, `fn_refund_amount`, R1/R3 insert trigger, slot-status sync trigger, row and advisory locking, seeding bypass (`db/03_booking.sql`), booking tests and two-session race demo (`db/tests/test_booking.sql`, `db/tests/race/`), Express core (pool, JWT, bcrypt, `requireRole`, transactional signup, `errors.js`), React shell and booking pages (`report/mubeen.md`) |
| Aditya Singh | 2024A8PS0491H | Schema and scheduling: core tables (`db/01_tables.sql`), composite FK (R8), GiST exclusion constraint (R2), availability overlap/divisibility trigger (R4), status lifecycle trigger (R5), `sp_generate_slots` (`db/02_schedule.sql`), schedule unit tests (`db/tests/test_schedule.sql`), doctor API (`server/routes/doctor.js`), and doctor frontend (`report/aditya.md`) |
| Priyadarshini Ghosh | 2024A8PS0479H | Reporting, analytical queries and admin portal: reporting views (`db/05_reports.sql`), analytical SQL queries (`db/07_queries.sql`), admin REST API (`server/routes/admin.js`), and React admin dashboard (`client/src/pages/admin/`) with clinic-scoped doctor management, appointment slot scheduling and management, appointment tracking, medicine and specialty CRUD, and multi-criteria filtering (`report/priyadarshini.md`) |
| Potta Avinash | 2024A8PS0473H | Data and performance: database seeding and test-data generation (`db/seed.sql`), performance indexes and query optimisation (`db/06_indexes.sql`), Q7 next-free-slots query (`queries/q7_next_free_slots.sql`), before/after query execution plan analysis (`db/explain/`), doctor search API (`server/routes/search.js`), and React doctor search page with doctor-name, city, specialty and appointment-date filters (`client/src/pages/search/`, `report/avinash.md`) |
| Suryanath A | 2024A8PS0471H | Clinical records, Rule 6 enforcement and QA: Rule 6 via `BEFORE INSERT OR UPDATE` triggers (`db/04_clinical.sql`), clinical test suite (`db/tests/test_clinical.sql`), automated runner (`db/tests/runall.sh`), clinical API (`server/routes/clinical.js`), and prescription/review UI (`client/src/pages/clinical/`, `report/suryanath.md`) |

Responsibility matrix (● lead):

| Area | Mubeen | Aditya | Priyadarshini | Avinash | Suryanath |
| --- | :-: | :-: | :-: | :-: | :-: |
| ER model, relational schema, BCNF notes | | ● | | | |
| Availability and slot generation (R2, R4, R5, R8) | | ● | | | |
| Booking, cancellation, refunds, locking (R1, R3, R7, R9) | ● | | | | |
| Clinical rule (R6) | | | | | ● |
| Reporting views and analytical queries | | | ● | | |
| Seed data, indexes, `EXPLAIN` analysis, Q7 | | | | ● | |
| Express core, JWT, bcrypt, role guard | ● | | | | |
| Doctor API and doctor UI | | ● | | | |
| Admin API and admin UI | | | ● | | |
| Search API and search UI | | | | ● | |
| Clinical API and prescription/review UI | | | | | ● |
| Booking UI and React shell | ● | | | | |
| Test suites and runner | ● (booking) | ● (schedule) | | | ● (clinical, runner) |

---

## Current progress

All phases are complete end to end: relational schema, integrity constraints and stored procedures, automated test suites, seed dataset, Express backend API and responsive React frontend.

| Component | State |
| --- | --- |
| Requirements and business rules (R1 to R9) | Done |
| ER diagram and relational mapping | Done |
| Normalisation (all 12 relations in BCNF) | Done |
| Schema: 12 tables, 7 triggers, 7 functions and procedures, 7 views | Done |
| Performance indexes (5 custom B-tree and partial, plus 2 constraint-backed) | Done |
| Test suite (schedule, booking, clinical, two-session race) | Done |
| Seed data (500+ records across 30 doctors and 120 patients) | Done |
| Express API, JWT auth, role guards and error mapping | Done |
| React (Vite) frontend: patient, doctor and admin flows | Done |
| Admin analytics reports and analytical queries Q1 to Q7 | Done |

---

## Users, roles and assumptions

| Who | What they do |
| --- | --- |
| Patient | Finds a doctor by specialty, city, fee or rating, books and pays, cancels for a refund, sees past visits and prescriptions, and reviews completed visits |
| Doctor | Sets a weekly availability pattern, generates slots from it, sees the day's appointments, marks them completed or no-show, writes prescriptions |
| Admin | Manages clinics, specialties and medicines, and reads the utilisation, no-show, demand and revenue reports |

Access is enforced twice: the API checks the JWT and role with `requireRole(...)`, and the database itself refuses anything that breaks a rule, whichever role (or script) sent it.

| Capability | Patient | Doctor | Admin |
| --- | :-: | :-: | :-: |
| Search doctors, view free slots | ✓ | ✓ | ✓ |
| Book and pay for a slot | ✓ | | |
| Cancel own appointment (tiered refund) | ✓ | | |
| Review a completed visit | ✓ | | |
| Set weekly availability, generate slots | | ✓ | |
| Mark appointments completed / no-show | | ✓ | |
| Write prescriptions | | ✓ | |
| Manage clinics, specialties, medicines | | | ✓ |
| View utilisation, demand, revenue reports | | | ✓ |

### Assumptions

- Each doctor works at one clinic and has one specialty.
- Payments are simulated and in rupees. Times are stored with a time zone and shown in IST.
- Availability is a weekly pattern (for example Monday 9:00 to 12:00 in 30-minute slots). Concrete slots are generated from the pattern for a range of dates.
- A cancelled slot goes back into the pool and can be booked again.
- A booking and its payment happen together. There is no pay-later option.

---

## Rules the database enforces on its own

| ID | Rule | Mechanism |
| --- | --- | --- |
| R1 | A slot can never have two live appointments, even when two people click at the same moment | Row lock in `sp_book_appointment`, BEFORE INSERT trigger, partial unique index |
| R2 | A doctor can never have two overlapping slots | EXCLUDE constraint (gist) on doctor and time range |
| R3 | A patient cannot have two overlapping appointments | BEFORE INSERT trigger with an advisory lock per patient |
| R4 | A doctor's weekly windows cannot overlap and must be divided into whole slots (9:00 to 12:00 in 25-minute slots is rejected) | Trigger and CHECK |
| R5 | An appointment goes from BOOKED to COMPLETED, NO_SHOW or CANCELLED, and stops there | BEFORE UPDATE trigger |
| R6 | Reviews and prescriptions are only allowed for completed appointments | BEFORE INSERT OR UPDATE triggers |
| R7 | Refund is 100% if cancelled 24 hours or more before the slot, 50% from 2 to 24 hours, nothing under 2 hours. Payment status must agree with the refund amount | `fn_refund_amount` and a CHECK on payment |
| R8 | A doctor row can only belong to a DOCTOR account and a patient row to a PATIENT account | Composite foreign key `(id, role)` |
| R9 | A slot that has already started cannot be booked | `sp_book_appointment` (a CHECK cannot use the current time) |

**Why the database and not the app?** Every rule above survives a second browser tab, a script run from `psql`, a bug in the API, or a future client written in another language. The API only translates database errors into readable messages.

### Refund policy (R7)

| Time before slot | Refund | Payment status after cancellation |
| --- | --- | --- |
| 24 hours or more | 100% | `REFUNDED` |
| 2 hours to under 24 hours | 50% | `PARTIALLY_REFUNDED` |
| Under 2 hours | 0% | `COMPLETED` |

The boundaries at exactly 24 h and 2 h are covered by dedicated edge-case tests in `db/tests/test_booking.sql`.

---

## Lifecycles

### Appointment status (R5)

```mermaid
stateDiagram-v2
    [*] --> BOOKED: sp_book_appointment
    BOOKED --> COMPLETED: doctor marks visit done
    BOOKED --> NO_SHOW: doctor marks missed
    BOOKED --> CANCELLED: sp_cancel_appointment
    COMPLETED --> [*]
    NO_SHOW --> [*]
    CANCELLED --> [*]
```

`COMPLETED`, `NO_SHOW` and `CANCELLED` are terminal: any attempt to move out of them is rejected by `trg_appointment_status_lifecycle`. `cancelled_at` is set exactly when the status is `CANCELLED`.

### Slot status

```mermaid
stateDiagram-v2
    [*] --> FREE: sp_generate_slots
    FREE --> BOOKED: appointment inserted (trg_sync_slot_status)
    BOOKED --> FREE: appointment cancelled
```

`slot.status` is deliberately redundant: it is changed only by a trigger inside the same transaction as the appointment change, so the two cannot drift apart. A cancelled slot returns to `FREE` and can be booked again, while the cancelled appointment row is kept as history.

---

## ER modelling

The model has 9 entities plus the `app_user` supertype, 2 weak entities (`availability`, `slot`), one specialisation (`app_user` into `patient` and `doctor`) and one M:N relationship carrying attributes (`prescribes`, between `appointment` and `medicine`, with `dosage` and `days_supply`).

Things worth highlighting:

- Patient and doctor are specialisations of `app_user`, so name, email and password live in one place. An admin is simply an `app_user` with no subtype, which is why the specialisation is partial.
- `slot` and `availability` are weak entities. A slot only makes sense as one of a particular doctor's slots, so it is identified through the doctor plus its start time.
- `prescribes` carries attributes, so it has its own table.
- A slot can have many appointments over time, but only one at any moment.

### Chen notation

Rectangles are entities, double rectangles are weak entities, diamonds are relationships, double diamonds are identifying relationships. Labels 1, N, M are cardinalities.

[![ER diagram](docs/images/er_diagram.png)](docs/images/er_diagram.png)

### Same model as an ER diagram (renders on GitHub)

```mermaid
erDiagram
    CLINIC ||--o{ DOCTOR : employs
    SPECIALTY ||--o{ DOCTOR : practises
    APP_USER ||--o| PATIENT : "ISA"
    APP_USER ||--o| DOCTOR : "ISA"
    DOCTOR ||--o{ AVAILABILITY : has_window
    DOCTOR ||--o{ SLOT : offers
    PATIENT ||--o{ APPOINTMENT : makes
    SLOT ||--o{ APPOINTMENT : is_for
    APPOINTMENT ||--o| PAYMENT : paid_by
    APPOINTMENT ||--o| REVIEW : reviewed_in
    APPOINTMENT ||--o{ PRESCRIPTION_ITEM : prescribes
    MEDICINE ||--o{ PRESCRIPTION_ITEM : prescribed_in
```

### Focused views with key attributes

People, clinics and specialties:

```mermaid
erDiagram
    APP_USER {
        int user_id PK
        text email UK
        text role "PATIENT / DOCTOR / ADMIN"
    }
    PATIENT {
        int patient_id PK
    }
    DOCTOR {
        int doctor_id PK
        int clinic_id FK
        int specialty_id FK
        text license_no UK
        numeric fee
        int experience_yrs
    }
    CLINIC {
        int clinic_id PK
        text name
        text address
        text city
    }
    SPECIALTY {
        int specialty_id PK
        text name UK
    }
    APP_USER ||--o| PATIENT : "ISA (id, role)"
    APP_USER ||--o| DOCTOR : "ISA (id, role)"
    CLINIC ||--o{ DOCTOR : employs
    SPECIALTY ||--o{ DOCTOR : practises
```

Scheduling, booking and payment:

```mermaid
erDiagram
    DOCTOR ||--o{ AVAILABILITY : has_window
    DOCTOR ||--o{ SLOT : offers
    PATIENT ||--o{ APPOINTMENT : makes
    SLOT ||--o{ APPOINTMENT : is_for
    APPOINTMENT ||--o| PAYMENT : paid_by
    AVAILABILITY {
        int avail_id PK
        int doctor_id FK
        int weekday "1 to 7"
        int slot_minutes "10,15,20,30,45,60"
    }
    SLOT {
        int slot_id PK
        int doctor_id FK
        timestamptz slot_start
        timestamptz slot_end
        text status "FREE / BOOKED"
    }
    APPOINTMENT {
        int appt_id PK
        int patient_id FK
        int slot_id FK
        text status
        timestamptz cancelled_at
    }
    PAYMENT {
        int payment_id PK
        int appt_id FK
        numeric amount "fee snapshot"
        numeric refund_amount
        text status
    }
```

Clinical records:

```mermaid
erDiagram
    APPOINTMENT ||--o{ PRESCRIPTION_ITEM : prescribes
    MEDICINE ||--o{ PRESCRIPTION_ITEM : prescribed_in
    APPOINTMENT ||--o| REVIEW : reviewed_in
    PRESCRIPTION_ITEM {
        int appt_id PK
        int medicine_id PK
        text dosage
        int days_supply "1 to 365"
    }
    MEDICINE {
        int medicine_id PK
        text name
        text form
        text strength
    }
    REVIEW {
        int review_id PK
        int appt_id FK
        int rating "1 to 5"
    }
```

> The attribute lists show the key columns only. The full column list for every table is in `db/01_tables.sql`.

### Specialisation of app_user

Patient and doctor share their primary key with `app_user` through the composite foreign key `(id, role)`. The `role` column is the discriminator, and because the pair is referenced rather than the id alone, a doctor row cannot point at a patient account (R8). The specialisation is partial: an admin is an `app_user` with no subtype row.

### Relationship table

| Relationship | Participants | Cardinality | Notes |
| --- | --- | --- | --- |
| employs | Clinic, Doctor | 1:N | Doctor total |
| practises | Specialty, Doctor | 1:N | Doctor total |
| ISA | app_user, Patient / Doctor | 1:1 | partial specialisation, admin has none |
| has window | Doctor, Availability | 1:N | Availability weak |
| offers | Doctor, Slot | 1:N | Slot weak |
| makes | Patient, Appointment | 1:N | |
| is for | Slot, Appointment | 1:N | many over time, one live at a moment |
| paid by | Appointment, Payment | 1:1 | `UNIQUE(appt_id)` |
| reviewed in | Appointment, Review | 1:1 | `UNIQUE(appt_id)` |
| prescribes | Appointment, Medicine | M:N | dosage, days_supply |

---

## Relational schema

Mapping from the diagram was mostly mechanical: entities became tables, subtypes share their key with `app_user`, each 1:N relationship became a foreign key on the N side, 1:1 relationships a UNIQUE foreign key, and `prescribes` became `prescription_item` with a composite key. Weak entities carry their doctor as a foreign key and also get a surrogate id; on `slot`, `UNIQUE (doctor_id, slot_start)` keeps the natural identifier intact.

| Relation | Primary key | Foreign keys (ON DELETE) and key constraints |
| --- | --- | --- |
| app_user | user_id | UNIQUE email (format CHECK); UNIQUE (user_id, role); role IN (PATIENT, DOCTOR, ADMIN) |
| patient | patient_id | (patient_id, role) → app_user(user_id, role) (CASCADE); role = PATIENT |
| clinic | clinic_id | UNIQUE (name, address); index on city |
| specialty | specialty_id | UNIQUE name |
| doctor | doctor_id | (doctor_id, role) → app_user (CASCADE); clinic_id → clinic (RESTRICT); specialty_id → specialty (RESTRICT); UNIQUE license_no |
| availability | avail_id | doctor_id → doctor (CASCADE); weekday 1 to 7; overlap trigger |
| slot | slot_id | doctor_id → doctor (CASCADE); UNIQUE (doctor_id, slot_start); EXCLUDE gist on doctor and time range |
| appointment | appt_id | patient_id → patient (RESTRICT); slot_id → slot (RESTRICT); partial UNIQUE (slot_id) WHERE status <> CANCELLED |
| payment | payment_id | appt_id → appointment (RESTRICT), UNIQUE |
| medicine | medicine_id | UNIQUE (name, form, strength) |
| prescription_item | (appt_id, medicine_id) | appt_id → appointment (CASCADE); medicine_id → medicine (RESTRICT) |
| review | review_id | appt_id → appointment (CASCADE), UNIQUE |

Key constraints: `email` format CHECK, `phone` 10 to 15 digits, `fee >= 0`, `experience_yrs` 0 to 60, `slot_minutes IN (10, 15, 20, 30, 45, 60)`, `slot_end > slot_start`, `rating` 1 to 5, `days_supply` 1 to 365, `0 <= refund_amount <= amount` with payment status matching the refund, and `cancelled_at` set exactly when status is `CANCELLED`.

**Delete behaviour in one line:** history is protected (`RESTRICT` on patients, slots, clinics, specialties, medicines and payments), while dependent detail is cleaned up with its parent (`CASCADE` on availability, slots, prescription items and reviews).

### Normalisation

Functional dependencies were written down for every table. In each one, whatever determines other attributes is a candidate key, so all 12 relations are in BCNF, which also puts them in 3NF.

Representative dependencies:

| Relation | Dependency | Determinant is a key? |
| --- | --- | --- |
| app_user | user_id → email, role, ... and email → user_id | Yes (PK and UNIQUE) |
| doctor | doctor_id → clinic_id, specialty_id, fee, ...; license_no → doctor_id | Yes |
| slot | slot_id → doctor_id, slot_start, slot_end, status; (doctor_id, slot_start) → slot_id | Yes (PK and candidate key) |
| appointment | appt_id → patient_id, slot_id, status, cancelled_at | Yes |
| payment | payment_id → appt_id, amount, refund_amount, status; appt_id → payment_id | Yes (PK and UNIQUE) |
| prescription_item | (appt_id, medicine_id) → dosage, days_supply | Yes |

Two choices that keep the design out of 2NF/3NF trouble: `appointment` has no `doctor_id` (appointment → slot → doctor would be a transitive dependency), and `clinic` stores city but not state, so there is no city → state dependency.

### Design decisions

1. **Partial unique index, not a plain `UNIQUE (slot_id)`.** A plain one breaks on cancellation, because the cancelled row would still hold the slot. The partial index only counts non-cancelled appointments, so history is kept and double booking is still impossible.
2. **Exclusion constraint on slots.** `UNIQUE (doctor_id, slot_start)` only stops identical slots; the exclusion constraint also stops a 10:10 to 10:40 slot from sitting on top of a 10:00 to 10:30 one.
3. **Composite `(id, role)` foreign key** stops a doctor row from referring to a patient account, so no trigger is needed.
4. **`slot.status` is deliberate redundancy.** It makes the free-slot search a single indexed scan, and it is only changed by a trigger in the same transaction as the appointment, so the two cannot drift apart.
5. **`payment.amount` snapshots the doctor's fee** at booking time, because the fee changes over time and an old payment must keep what was actually charged.
6. **Booking, cancelling and slot generation are SQL functions**, so any client (web app, script or test) gets the same guarantees and everything can be demoed from `psql`.
7. **An advisory lock per patient** closes the one gap a row lock cannot: two simultaneous bookings by the same patient for two different slots at the same time. The row lock protects the slot, the advisory lock protects the patient (R3).
8. **Tested.** `schema.sql` loads on PostgreSQL 16 and the SQL suites cover R1 to R9, including two sessions racing for the same slot: the second waits for the first to commit and is then rejected.

---

## Architecture and technology stack

```mermaid
flowchart LR
    subgraph Client["React (Vite)"]
        P[Patient pages]
        D[Doctor pages]
        A[Admin pages]
    end
    subgraph API["Express API"]
        M["JWT + requireRole"]
        R["Routes: booking, doctor,<br/>search, clinical, admin"]
        E["errors.js<br/>DB error → message"]
    end
    subgraph DB["PostgreSQL 16"]
        F["Functions / procedures"]
        T["Triggers + constraints"]
        V["Views + indexes"]
    end
    P --> M
    D --> M
    A --> M
    M --> R --> F
    R --> V
    F --> T
    T -. violation .-> E
    E -. readable message .-> Client
```

React frontend ↔ Express API ↔ PostgreSQL 16.

| Layer | Technology |
| --- | --- |
| Database | PostgreSQL 16 with the `btree_gist` extension |
| Backend | Node.js, Express, `pg` driver (connection pool) |
| Frontend | React (Vite), separate patient, doctor and admin pages |
| Security | JWT authentication, bcrypt password hashing, role checks in API |

The API stays thin on purpose: it checks the token and role, calls the SQL functions or runs the queries, and turns database errors (unique, check, exclusion, trigger) into readable messages.

### API modules

| Module | Responsibility |
| --- | --- |
| Core (`server/`) | Connection pool, JWT, bcrypt, `requireRole`, transactional signup, `errors.js` |
| Booking routes | Book (`/api/booking/book`) and cancel, delegating to `sp_book_appointment` and `sp_cancel_appointment` |
| `server/routes/doctor.js` | Weekly availability, slot generation, the doctor's daily schedule, status updates |
| `server/routes/search.js` | Doctor search by name, city, specialty and appointment date |
| `server/routes/clinical.js` | Prescriptions and reviews |
| `server/routes/admin.js` | Clinics, specialties, medicines, reports and analytical queries |

### Frontend pages

| Route | Who | Purpose |
| --- | --- | --- |
| `/signup/doctor` | Doctor | Register, choosing an existing clinic or creating one in the same transaction |
| `/appointments` | Patient | Consultation history, prescriptions, reviews, cancellation |
| `/doctor` | Doctor | Daily schedule, mark completed / no-show |
| `/visits/:apptId/prescription` | Doctor | Issue a prescription for a completed visit |
| `/admin` | Admin | Metrics, catalogue management, clinics, reports |

---

## Workflows implemented

### W1: Book an appointment (atomic transaction)

The patient searches doctors by specialty, city, or date, chooses an available slot, and books via `/api/booking/book`. The backend invokes `sp_book_appointment`, which:

1. Acquires a patient-level transactional advisory lock (`pg_advisory_xact_lock(4801, patient_id)`) to prevent concurrent overlapping bookings by the same patient.
2. Locks the target slot row (`SELECT ... FOR UPDATE`), asserting current status is `FREE` and slot start time is strictly in the future (R9).
3. Inserts the appointment record and verifies against R1 (no double booking) and R3 (no patient time clash) via database triggers.
4. Inserts the payment record, snapshotting the doctor's active consultation fee and payment method (`CASH`, `CARD`, `UPI`).
5. The `AFTER INSERT` trigger automatically synchronises `slot.status` to `BOOKED`. If any step fails, the entire transaction rolls back cleanly.

```mermaid
sequenceDiagram
    participant UI as React
    participant API as Express
    participant DB as PostgreSQL
    UI->>API: POST /api/booking/book (slot, method)
    API->>DB: CALL sp_book_appointment(...)
    DB->>DB: advisory lock on patient (R3)
    DB->>DB: SELECT slot FOR UPDATE (R1)
    DB->>DB: check FREE and in the future (R9)
    DB->>DB: INSERT appointment (triggers R1, R3)
    DB->>DB: INSERT payment (fee snapshot)
    DB->>DB: trigger sets slot BOOKED
    DB-->>API: commit (or rollback with rule error)
    API-->>UI: confirmation or readable error
```

### W2: Admin portal and reporting views

The admin dashboard (`/admin`) provides platform-wide oversight:

1. System metrics cards: registered clinics, specialties, medicines, doctor and patient counts, active bookings, and net revenue.
2. Master catalogue management: interactive CRUD for medical specialties and medicines (form, dosage, strength).
3. Clinics overview: view doctor counts per clinic registered by doctors.
4. Reporting suite: real-time query rendering for `v_doctor_utilisation`, `v_specialty_demand`, `v_clinic_revenue`, and analytical queries Q1 to Q7.

### W3: Clinical records and Rule 6 demonstration

1. Doctors view their daily schedule (`/doctor`), mark appointments as `COMPLETED` or `NO_SHOW` (R5 lifecycle enforcement), and issue prescriptions (`/visits/:apptId/prescription`).
2. Patients view consultation history (`/appointments`), read prescriptions, and submit reviews (1 to 5 stars with comments).
3. Rule 6 is enforced at the database level by `BEFORE INSERT OR UPDATE` triggers on `prescription_item` and `review`. Attempting to prescribe or review a `BOOKED` or `CANCELLED` visit terminates immediately with `R6: Prescriptions and reviews are only allowed for completed appointments`.

### Additional core workflows

- **Appointment cancellation and tiered refunds (`sp_cancel_appointment`):** locks the appointment, evaluates `fn_refund_amount` (100% at 24 h or more, 50% for 2 to 24 h, 0% under 2 h), updates payment status to `REFUNDED` / `PARTIALLY_REFUNDED` / `COMPLETED`, releases the slot back to `FREE`, and records the `cancelled_at` timestamp.
- **Automated slot generation (`sp_generate_slots` / `sp_generate_all_slots`):** expands doctors' weekly availability windows into discrete time-bound slots across target date ranges, guarded against duplicates and overlaps by the GiST exclusion constraint (R2).
- **Doctor registration with clinic creation:** doctors can sign up (`/signup/doctor`) by selecting an existing clinic or creating a new clinic on the fly in a single atomic transaction.

---

## DBMS features

| Feature | Objects and implementation |
| --- | --- |
| **Transactions and concurrency** | Row-level locks (`SELECT ... FOR UPDATE`), transaction-level advisory locks (`pg_advisory_xact_lock(4801, patient_id)`), atomic multi-table stored procedures (`sp_book_appointment`, `sp_cancel_appointment`), READ COMMITTED isolation |
| **Triggers (7)** | `trg_check_availability_overlap` (`availability`), `trg_check_appointment_clash` (`appointment`), `trg_sync_slot_status` (`appointment`), `trg_appointment_status_lifecycle` (`appointment`), `trg_protect_booked_slots` (`slot`), `trg_enforce_r6_prescription` (`prescription_item`), `trg_enforce_r6_review` (`review`) |
| **Functions and procedures (7)** | `sp_book_appointment`, `sp_cancel_appointment`, `sp_generate_slots`, `sp_generate_all_slots`, `fn_refund_amount`, `fn_check_completed_appointment`, `fn_check_availability_overlap` |
| **Views (7)** | `v_slot_details`, `v_patient_appointments`, `v_doctor_appointments`, `v_doctor_profile`, `v_doctor_utilisation`, `v_specialty_demand`, `v_clinic_revenue` |
| **Indexes (7)** | GiST exclusion constraint (`slot_no_overlap`), partial unique index (`idx_appointment_slot_active`), partial B-tree (`idx_slot_doctor_start_status`), composite indexes (`idx_doctor_specialty_clinic`, `idx_appointment_patient`, `idx_payment_appt`, `idx_clinic_city`) |
| **Constraints** | PK, FK with explicit `ON DELETE`, UNIQUE, CHECK, composite FK (R8), EXCLUDE (R2) |
| **Extensions** | `btree_gist` (needed for the exclusion constraint on doctor plus time range) |

---

## Analytical SQL queries (Q1 to Q7)

All seven analytical queries are implemented in `db/07_queries.sql` and `queries/q7_next_free_slots.sql`, and accessible via the admin reports interface.

| Query | Question answered | Technique |
| --- | --- | --- |
| **Q1: Peak booking hours** | At which hours of the day are slots booked most? | `GROUP BY EXTRACT(HOUR FROM s.slot_start)` |
| **Q2: Doctor performance vs specialty benchmark** | Which doctors beat the average rating of their own specialty? | CTEs and subqueries |
| **Q3: Top doctors by completed visits** | Who handles the most completed visits, with ties ranked fairly? | `DENSE_RANK() OVER (ORDER BY completed_count DESC)` |
| **Q4: Patient retention** | Which patients keep returning to the same doctor? | Group by `(patient_id, doctor_id)`, `HAVING COUNT(a.appt_id) >= 2` |
| **Q5: Revenue by payment method** | Gross revenue, refund liability and net revenue per `CASH`, `CARD`, `UPI` | Conditional aggregation |
| **Q6: Doctor cancellation rate** | Which practitioners have elevated cancellation frequency? | Conditional aggregation and `HAVING` |
| **Q7: Next three free slots per doctor** | What can a patient book soonest, per doctor? | `ROW_NUMBER() OVER (PARTITION BY s.doctor_id ORDER BY s.slot_start)` |

Q7 is validated with before/after `EXPLAIN ANALYZE` benchmarks in `db/explain/`, showing the speed-up from index-only scans.

---

## Performance and indexing

Indexes were added after looking at the query plans, not before. The workflow was: run `EXPLAIN ANALYZE` on the slow query, add the index in `db/06_indexes.sql`, re-run, and keep the before/after plans in `db/explain/`.

| Index | Serves |
| --- | --- |
| `idx_slot_doctor_start_status` (partial, `WHERE status = 'FREE'`) | Free-slot search and Q7: only free slots are indexed, so the index stays small |
| `idx_doctor_specialty_clinic` | Search by specialty and clinic |
| `idx_appointment_patient` | A patient's appointment history and the R3 clash check |
| `idx_payment_appt` | Joining payments to appointments in revenue reports |
| `idx_clinic_city` | City filter in doctor search |
| `slot_no_overlap` (GiST) | R2 enforcement, and time-range lookups per doctor |
| `idx_appointment_slot_active` (partial unique) | R1 enforcement |

---

## Seed dataset

The database includes a realistic dataset defined in `db/seed.sql`, comprising 500+ records:

| Entity | Count | Notes |
| --- | --- | --- |
| Clinics | 6 | Hyderabad, Bengaluru, Mumbai |
| Specialties | 12 | Cardiology, Dermatology, Orthopedics, Pediatrics, and more |
| Doctors | 30 | Licence numbers, experience, consultation fees |
| Patients | 120 | Demographics and dates of birth |
| Medicines | 25 | Forms: `TABLET`, `CAPSULE`, `SYRUP`, `INJECTION`, `OINTMENT`, `DROPS`, `OTHER` |
| Slots | 2,000+ | Generated from weekly doctor availability patterns |
| Appointments | 400 | With payments, seeded through `sp_book_appointment` and `sp_cancel_appointment` |
| Prescription items | 250 | |
| Reviews | 120 | |
| Admin | 1 | `admin@medislot.demo` |

Appointments are seeded through the real booking and cancellation functions under `SET medislot.seeding = 'on'`, which bypasses only the "slot must be in the future" check. That keeps every row relationally consistent and every refund amount correct, instead of inserting rows that could never have been produced by the app.

---

## Test suite and automated runner

| Suite | Assertions | What it proves |
| --- | --- | --- |
| `db/tests/test_schedule.sql` | 40 | Availability intervals (R4), slot generation, the exclusion constraint (R2), appointment lifecycle transitions (R5), composite FK (R8), doctor views |
| `db/tests/test_booking.sql` | 27 | R1 (no double booking), R3 (no patient overlap), R7 (refund edge cases at 24 h and 2 h), R9 (no booking past slots), advisory locking, view outputs |
| `db/tests/test_clinical.sql` | positive and negative cases | R6: prescriptions and reviews allowed on completed visits, rejected on booked or cancelled ones |
| `db/tests/race/` | two-session demo | Physical row-lock serialisation on a double-booking attempt |
| `db/tests/runall.sh` | n/a | Schema initialisation, seed loading and every suite in a clean sequence with `ON_ERROR_STOP=1` |

Tests run inside transactions, so they leave no data behind.

### The two-session race (R1)

1. In terminal A run `db/tests/race/session_a.sql`: it books a slot and pauses before committing, holding the row lock.
2. In terminal B, while A waits, run `db/tests/race/session_b.sql`: it tries to book the same slot and blocks on the lock.
3. A commits. B wakes up, sees the slot is no longer free, and is rejected with the R1 error.

This is the proof that "two people clicking at the same moment" cannot both succeed.

---

## Repository layout

```
MediSlot/
  README.md
  docs/images/               diagram images
  db/
    01_tables.sql            tables, CHECKs, FKs, composite FK (R8), GiST exclusion (R2), partial index
    02_schedule.sql          availability trigger (R4), status lifecycle (R5), sp_generate_slots
    03_booking.sql           booking transactions, cancellation, refund calculation
    04_clinical.sql          prescriptions and reviews (R6)
    05_reports.sql           reporting views (doctor utilisation, specialty demand, clinic revenue)
    06_indexes.sql           performance indexes
    07_queries.sql           analytical queries (Q1 to Q6)
    seed.sql                 seed data (500+ records)
    explain/                 before/after EXPLAIN ANALYZE plans
    tests/
      test_schedule.sql      R2, R4, R5, R8 and slot generation (40 assertions)
      test_booking.sql       R1, R3, R7, R9 (27 assertions)
      test_clinical.sql      R6
      race/                  two-session double-booking demo
      runall.sh              automated runner on a fresh database
  queries/
    q7_next_free_slots.sql   Q7, next three free slots per doctor
  server/                    Express backend (auth, booking, doctor, clinical, admin, search)
  client/                    React Vite frontend (patient, doctor, admin portals)
  report/                    individual contribution reports
```

---

## Setup

### Prerequisites

- PostgreSQL 16 with the `btree_gist` extension available
- Node.js (current LTS) and npm

### Database

```bash
createdb medislot
psql -d medislot -f db/01_tables.sql
psql -d medislot -f db/02_schedule.sql
psql -d medislot -f db/03_booking.sql
psql -d medislot -f db/04_clinical.sql
psql -d medislot -f db/05_reports.sql
psql -d medislot -f db/06_indexes.sql
psql -d medislot -f db/07_queries.sql
psql -d medislot -f db/seed.sql
```

Or let the runner do schema, seed and all tests in one go on a fresh database:

```bash
bash db/tests/runall.sh
```

Run a single suite:

```bash
psql -d medislot -f db/tests/test_schedule.sql
psql -d medislot -f db/tests/test_booking.sql
psql -d medislot -f db/tests/test_clinical.sql
```

Two-session race (R1), on a seeded database: run `db/tests/race/session_a.sql` in one terminal and, while it waits, `db/tests/race/session_b.sql` in another.

### Application

Backend:

```bash
cd server
cp .env.example .env        # set DATABASE_URL and JWT_SECRET
npm install
npm start                   # API on http://localhost:4000
```

Frontend:

```bash
cd client
npm install
npm run dev                 # UI on http://localhost:5173, /api proxied to :4000
```

| Variable | Meaning |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string, for example `postgres://user:pass@localhost:5432/medislot` |
| `JWT_SECRET` | Secret used to sign login tokens |

### Demo logins

After loading `db/seed.sql`:

| Role | Email | Password |
| --- | --- | --- |
| Patient | `patient1@medislot.demo` to `patient120@medislot.demo` | `demo1234` |
| Doctor | `doctor1@medislot.demo` to `doctor30@medislot.demo` | `demo1234` |
| Admin | `admin@medislot.demo` | `admin123` |

Seeded users need bcrypt password hashes to be able to log in, for example `crypt('password', gen_salt('bf'))` from `pgcrypto`.

---

## Demo walkthrough

A suggested path for showing the project end to end:

1. **Search and book (patient).** Log in as `patient1`, search by specialty and city, pick a free slot and book with UPI. The slot disappears from the free list.
2. **Try to break R3.** Book a second slot that overlaps the first. The database rejects it.
3. **Cancel for a refund.** Cancel the appointment and compare the refund with the time left before the slot (R7). The slot is free again.
4. **Run the race.** Use the two `psql` sessions from the test suite to show that two simultaneous bookings of one slot cannot both succeed (R1).
5. **Doctor day (doctor).** Log in as `doctor1`, open the daily schedule, mark a visit `COMPLETED`, then try to change it back to `BOOKED` and watch R5 refuse.
6. **Clinical rule (doctor and patient).** Write a prescription for the completed visit, then try the same on a `BOOKED` visit to see the R6 error. As the patient, review the completed visit.
7. **Admin (admin).** Log in as `admin@medislot.demo`, open `/admin`, and walk through the metrics cards, catalogue CRUD, `v_doctor_utilisation`, `v_clinic_revenue` and Q1 to Q7.

---

## Extending the project

To add your area: put an Express router in `server/routes/<area>.js` (mounted at `/api` automatically) and your pages in `client/src/pages/<area>/` with a `routes.jsx` that default-exports `[{ path, element, roles, nav }]` (picked up automatically). Use `requireRole(...)` from `server/auth/requireRole.js` and `api` from `client/src/api.js`.

When adding a business rule, follow the pattern used throughout: put the rule in the database first (constraint if it can be one, otherwise a trigger or function), add a positive and a negative case to the relevant file in `db/tests/`, and only then expose it in the API.

---

## Known limitations

- Payments are simulated; there is no real payment gateway and no pay-later option.
- A doctor belongs to exactly one clinic and one specialty.
- Availability is a weekly pattern; one-off exceptions (leave, holidays) are handled by not generating or by removing the affected slots rather than by an exceptions table.
- Isolation is READ COMMITTED; correctness under concurrency relies on explicit row and advisory locks instead of SERIALIZABLE.

---

## Individual contribution reports

Full technical documentation and design write-ups by each team member are in the `report/` directory:

- **Mohammad Mubeen Khan** (`report/mubeen.md`): atomic booking transaction (`sp_book_appointment`), cancellation and tiered refund calculation (`sp_cancel_appointment`, `fn_refund_amount`), R1/R3 database triggers, row and advisory locking, seeding bypass, Express core, and booking UI.
- **Aditya Singh** (`report/aditya.md`): relational schema design, BCNF normalisation, composite subtype foreign keys (R8), GiST exclusion constraints (R2), weekly availability and slot generation routines (`sp_generate_slots`), doctor routes, and scheduling interface.
- **Potta Avinash** (`report/avinash.md`): transaction-consistent seed dataset (500+ records across 30 doctors and 120 patients), 5 custom performance B-tree and partial indexes (`db/06_indexes.sql`), `EXPLAIN` benchmarking, window query Q7 (`queries/q7_next_free_slots.sql`), doctor search API, and search UI.
- **Priyadarshini Ghosh** (`report/priyadarshini.md`): analytical views (`v_doctor_utilisation`, `v_specialty_demand`, `v_clinic_revenue`), SQL analytics suite (`db/07_queries.sql`), admin API endpoints (`server/routes/admin.js`), and admin portal interface (`client/src/pages/admin/`).
- **Suryanath A** (`report/suryanath.md`): database enforcement of Rule 6 via `BEFORE INSERT OR UPDATE` triggers on `prescription_item` and `review`, transactional clinical test suite (`db/tests/test_clinical.sql`), clinical API routes, and prescription/review user interface.

---

GitHub: [https://github.com/aditya-1308/MediSlot](https://github.com/aditya-1308/MediSlot)