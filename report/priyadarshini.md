# Analytics, Reporting Views & Admin Management (Priyadarshini Ghosh, 2024A8PS0479H)

**Rules owned / focus:** Analytical database views, complex aggregation queries (Q1–Q6), administrative platform monitoring and catalogue management.  
**Files:** `db/05_reports.sql`, `db/07_queries.sql`, `server/routes/admin.js`, `client/src/pages/admin/`

**Reporting database views.** `db/05_reports.sql` defines three core views that provide administrative and operational visibility without requiring raw table joins in application code:
1. `v_doctor_utilisation`: Computes per-doctor slot counts (total, booked, completed, cancelled) and calculates utilisation rates as `ROUND(booked::NUMERIC / NULLIF(total, 0), 4)`.
2. `v_specialty_demand`: Aggregates slot consumption across medical specialties and applies `DENSE_RANK() OVER (ORDER BY COUNT(a.appt_id) DESC)` to establish specialty demand rankings.
3. `v_clinic_revenue`: Aggregates financial performance per clinic, computing completed visits, gross fees collected, refunds disbursed via `payment.refund_amount`, and net clinic revenue (`gross - refunds`).

**Analytical query suite (Q1–Q6).** `db/07_queries.sql` implements advanced SQL queries demonstrating joins, subqueries, CTEs, and window functions:
- *Q1 (Peak Booking Hours):* Groups slot start timestamps by `EXTRACT(HOUR FROM s.slot_start)` to identify peak appointment traffic times.
- *Q2 (Doctor vs Specialty Average Rating):* Uses a Common Table Expression to calculate average ratings per specialty and filters doctors whose personal average rating exceeds their specialty benchmark.
- *Q3 (Top Doctors by Completed Appointments):* Employs `DENSE_RANK()` over completed visit counts per doctor.
- *Q4 (Patient Retention):* Groups visits by `(patient_id, doctor_id)` with `HAVING COUNT(a.appt_id) >= 2` to highlight returning patient relationships.
- *Q5 (Revenue by Payment Method):* Analyzes revenue and refund flows split across `CASH`, `CARD`, and `UPI`.
- *Q6 (Cancellation Rate by Doctor):* Identifies practitioners with high cancellation frequencies using conditional `COUNT(CASE WHEN status = 'CANCELLED' ...)` and `HAVING`.

**Admin API and dashboard.** `server/routes/admin.js` secures `/api/admin/*` under `requireRole('ADMIN')`. It delivers system metrics (`/stats`), full CRUD over master catalogues (`/specialties`, `/medicines`), clinic overviews, and streaming access to analytical views and queries Q1–Q7. The React interface (`client/src/pages/admin/`) includes the primary dashboard, interactive specialty and medicine catalogues, and a four-tab report interface with dynamic table rendering.
