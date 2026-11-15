# Analytics, Reporting Views & Admin Management (Priyadarshini Ghosh, 2024A8PS0479H)

**Rules owned / focus:** Analytical database views, complex aggregation queries (Q1–Q6), administrative platform monitoring and catalogue management.  
**Files:** `db/05_reports.sql`, `db/07_queries.sql`, `server/routes/admin.js`, `client/src/pages/admin/`

**Reporting database views.** `db/05_reports.sql` defines three core views that provide administrative and operational visibility without requiring raw table joins in application code:
1. `v_doctor_utilisation`: Uses `COUNT(DISTINCT ...)` with `FILTER (WHERE ...)` clauses to compute per-doctor slot counts (total, booked) and appointment outcomes (completed, no-show, cancelled) without overcounting slots with historical cancellations, calculating the percentage as `ROUND(COALESCE(booked::NUMERIC / NULLIF(total, 0) * 100, 0), 2)`.
2. `v_specialty_demand`: Aggregates doctor supply (`total_doctors_count`), total and completed appointments, unique patients served, and net revenue (`SUM(p.amount - p.refund_amount)`) across each medical specialty.
3. `v_clinic_revenue`: Summarises financial performance per clinic, reporting total processed payments, gross revenue, total refunded amount (`payment.refund_amount`), and net clinic revenue (`gross - refunds`).

**Analytical query suite (Q1–Q6).** `db/07_queries.sql` implements advanced SQL queries demonstrating joins, subqueries, CTEs, and window functions:
* **Q1 (Utilisation and No-Show Rate per Clinic):** Uses `GROUP BY`, `HAVING COUNT(DISTINCT a.appt_id) > 0`, and conditional `FILTER` / `CASE` aggregations to calculate booked slots and patient no-show rates across active clinics.
* **Q2 (Top Specialties per City):** Uses a Common Table Expression with `RANK() OVER (PARTITION BY c.city ORDER BY COUNT(DISTINCT a.appt_id) DESC)` to rank and filter the top 3 most-booked specialties in each city.
* **Q3 (Doctors Above Their Specialty Average):** Uses dual CTEs (`doctor_completed` and `specialty_avg`) to compare each doctor's completed consultation count against their specialty's mean and return above-average performers.
* **Q4 (Repeat Patients):** Groups bookings by patient with `HAVING COUNT(DISTINCT a.appt_id) > 1` to identify returning patients and count distinct clinics visited.
* **Q5 (Most Prescribed Medicines per Specialty):** Joins `specialty`, `doctor`, `slot`, `appointment`, `prescription_item`, and `medicine` to rank top prescribed drugs and total days supplied per specialty.
* **Q6 (Monthly Revenue Trend):** Groups paid and refunded transactions by `TO_CHAR(p.paid_at, 'YYYY-MM')` and clinic to track monthly gross revenue, refunds, and net collections.

**Admin API and dashboard.** `server/routes/admin.js` secures `/api/admin/*` under `requireRole('ADMIN')` and resolves the administrator's assigned clinic (`resolveAdminClinic`). It delivers clinic-scoped overview metrics, top specialty demand, and recent bookings (`/admin/dashboard`), doctor onboarding and profile management across, overlap-checked single and auto-split consultation slot scheduling (`/admin/slots`), clinic appointment and payment tracking (`/admin/appointments`), and full CRUD over master catalogues (`/admin/specialties`, `/admin/medicines`). The React interface (`client/src/pages/admin/`) wires these routes through `routes.jsx` and `admin.css` into six views:

* `AdminDashboard.jsx`: Displays clinic-level KPI cards (doctors, open future slots, upcoming bookings, past appointments, catalog totals, and net revenue after refunds) alongside specialty demand and recent appointment tables.
* `DoctorsAdmin.jsx`: Provides clinic doctor creation and editing (contact details, specialty, license number, fee, experience, and optional password reset) with instant search filtering by name, email, specialty, or license number.
* `SlotsAdmin.jsx`: Supports single-range and auto-split (15–60 min) slot creation, timing edits, and deletion of unbooked (`FREE`) slots, paired with multi-criteria filtering by doctor (with specialty), specific date, and booking status.
* `AppointmentsAdmin.jsx`: Separates clinic bookings into `Upcoming`, `Past`, and `All` tabs with keyword search and an expandable detail card showing patient info, slot timestamps, visit reason, and payment/refund status.
* `SpecialtiesAdmin.jsx` & `MedicinesAdmin.jsx`: Provide full CRUD management for medical specialties and prescription medicines (name, dosage form, and strength) with live search filtering and inline delete confirmation.
