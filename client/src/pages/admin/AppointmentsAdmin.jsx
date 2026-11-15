// MediSlot | client/src/pages/admin/AppointmentsAdmin.jsx
import { useEffect, useState } from 'react';
import { api, formatRupees, formatWhen } from '../../api';
import './admin.css';

export default function AppointmentsAdmin() {
  const [clinic, setClinic] = useState(null);
  const [appointments, setAppointments] = useState(null);
  const [tab, setTab] = useState('UPCOMING');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/admin/appointments')
      .then((data) => {
        setClinic(data.clinic);
        setAppointments(data.appointments);
      })
      .catch((err) => setError(err.message));
  }, []);

  const now = new Date();

  const byTab = appointments?.filter((a) => {
    const start = new Date(a.slot_start);
    const isUpcoming = start >= now && a.status === 'BOOKED';
    if (tab === 'UPCOMING') return isUpcoming;
    if (tab === 'PAST') return !isUpcoming;
    return true;
  });

  const filtered = byTab?.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.patient_name.toLowerCase().includes(q) ||
      a.doctor_name.toLowerCase().includes(q) ||
      a.specialty_name.toLowerCase().includes(q) ||
      a.status.toLowerCase().includes(q)
    );
  });

  const upcomingCount = appointments?.filter(
    (a) => new Date(a.slot_start) >= now && a.status === 'BOOKED'
  ).length ?? 0;
  const pastCount = (appointments?.length ?? 0) - upcomingCount;

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Appointments</h1>
          {clinic && (
            <p className="muted" style={{ marginTop: '-0.6rem' }}>
              {clinic.name} · {clinic.city}
            </p>
          )}
        </div>
        <div className="quick-links">
          <button
            className={tab === 'UPCOMING' ? '' : 'secondary'}
            onClick={() => setTab('UPCOMING')}
          >
            Upcoming ({upcomingCount})
          </button>
          <button
            className={tab === 'PAST' ? '' : 'secondary'}
            onClick={() => setTab('PAST')}
          >
            Past ({pastCount})
          </button>
          <button
            className={tab === 'ALL' ? '' : 'secondary'}
            onClick={() => setTab('ALL')}
          >
            All ({appointments?.length ?? 0})
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {selected && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Appointment #{selected.appt_id} details</h2>
            <button className="secondary btn-sm" onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
          <div className="admin-grid" style={{ marginTop: '0.75rem', marginBottom: '0.5rem' }}>
            <div className="stat-card">
              <span className="stat-label">Patient</span>
              <strong>{selected.patient_name}</strong>
              <span className="muted small">{selected.patient_email}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Doctor &amp; Specialty</span>
              <strong>{selected.doctor_name}</strong>
              <span className="muted small">{selected.specialty_name}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Slot Time</span>
              <strong>{formatWhen(selected.slot_start)}</strong>
              <span className="muted small">Booked: {formatWhen(selected.booked_at)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Status &amp; Payment</span>
              <div>
                <span className={`pill ${selected.status.toLowerCase()}`}>
                  {selected.status.replace('_', ' ')}
                </span>
              </div>
              <span className="muted small">
                {selected.fee_paid != null
                  ? `Paid ${formatRupees(selected.fee_paid)}${
                      Number(selected.refund_amount) > 0
                        ? ` (Refunded ${formatRupees(selected.refund_amount)})`
                        : ''
                    }`
                  : 'No payment record'}
              </span>
            </div>
          </div>
          {selected.reason && (
            <p className="small" style={{ marginTop: '0.5rem' }}>
              <strong>Visit reason:</strong> {selected.reason}
            </p>
          )}
        </div>
      )}

      <div className="admin-toolbar">
        <input
          className="admin-search"
          type="search"
          placeholder="Search appointments by patient, doctor, specialty, or status…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {filtered && (
          <span className="muted small">
            Showing {filtered.length} {tab.toLowerCase()} appointments
          </span>
        )}
      </div>

      {!appointments && !error && <p className="muted">Loading appointments…</p>}

      {filtered && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>When</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Fee</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    No {tab.toLowerCase()} appointments found.
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
                  <tr key={a.appt_id}>
                    <td className="muted">#{a.appt_id}</td>
                    <td className="small"><strong>{formatWhen(a.slot_start)}</strong></td>
                    <td>
                      <div><strong>{a.patient_name}</strong></div>
                      <div className="muted small">{a.patient_email}</div>
                    </td>
                    <td>
                      <div>{a.doctor_name}</div>
                      <div className="muted small">{a.specialty_name}</div>
                    </td>
                    <td className="small">
                      {a.fee_paid != null ? formatRupees(a.fee_paid) : '—'}
                    </td>
                    <td>
                      <span className={`pill ${a.status.toLowerCase()}`}>
                        {a.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button className="secondary btn-sm" onClick={() => setSelected(a)}>
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}