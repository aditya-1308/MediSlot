// MediSlot | client/src/pages/admin/AdminDashboard.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatRupees, formatWhen } from '../../api';
import './admin.css';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/dashboard')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const stats = data?.stats;
  const clinic = data?.clinic;

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>{clinic ? `${clinic.name} — Admin` : 'Admin dashboard'}</h1>
          <p className="muted" style={{ marginTop: '-0.6rem' }}>
            {clinic
              ? `${clinic.address}, ${clinic.city}`
              : 'Manage doctors, slots, appointments, specialties, and medicines'}
          </p>
        </div>
        <div className="quick-links">
          <Link className="button" to="/admin/doctors">+ Doctor</Link>
          <Link className="button secondary" to="/admin/slots">+ Slots</Link>
          <Link className="button secondary" to="/admin/appointments">Appointments</Link>
          <Link className="button secondary" to="/admin/specialties">Specialties</Link>
          <Link className="button secondary" to="/admin/medicines">Medicines</Link>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading dashboard…</p>}

      {stats && (
        <>
          <div className="admin-grid">
            <div className="stat-card">
              <span className="stat-label">Doctors</span>
              <span className="stat-value">{stats.doctors}</span>
              <Link className="small" to="/admin/doctors">Manage doctors →</Link>
            </div>
            <div className="stat-card">
              <span className="stat-label">Open Future Slots</span>
              <span className="stat-value">{stats.open_slots}</span>
              <Link className="small" to="/admin/slots">Manage slots →</Link>
            </div>
            <div className="stat-card">
              <span className="stat-label">Upcoming Bookings</span>
              <span className="stat-value">{stats.upcoming_bookings}</span>
              <Link className="small" to="/admin/appointments">View upcoming →</Link>
            </div>
            <div className="stat-card">
              <span className="stat-label">Past Appointments</span>
              <span className="stat-value">{stats.past_appointments}</span>
              <Link className="small" to="/admin/appointments">View history →</Link>
            </div>
            <div className="stat-card">
              <span className="stat-label">Specialties / Medicines</span>
              <span className="stat-value">{stats.specialties} / {stats.medicines}</span>
              <span className="muted small">Master catalogs</span>
            </div>
            <div className="stat-card accent">
              <span className="stat-label">Net Revenue</span>
              <span className="stat-value">{formatRupees(stats.net_revenue)}</span>
              <span className="muted small">After refunds</span>
            </div>
          </div>

          <div className="admin-two-col">
            <div className="card">
              <h2>Specialty demand</h2>
              {data.specialtyDemand.length === 0 ? (
                <p className="muted small">No specialty demand data yet.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Specialty</th>
                      <th>Doctors</th>
                      <th>Appointments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.specialtyDemand.map((row, idx) => (
                      <tr key={row.specialty_id ?? idx}>
                        <td><strong>{row.specialty_name ?? row.name}</strong></td>
                        <td>{row.total_doctors_count ?? 0}</td>
                        <td>{row.total_appointments ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <h2>Recent appointments</h2>
              {data.recentAppointments.length === 0 ? (
                <p className="muted small">No appointments recorded yet.</p>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Patient / Doctor</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentAppointments.map((a) => (
                      <tr key={a.appt_id}>
                        <td className="small">{formatWhen(a.slot_start)}</td>
                        <td>
                          <div><strong>{a.patient_name}</strong></div>
                          <div className="muted small">{a.doctor_name} · {a.specialty_name}</div>
                        </td>
                        <td>
                          <span className={`pill ${a.status.toLowerCase()}`}>
                            {a.status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}