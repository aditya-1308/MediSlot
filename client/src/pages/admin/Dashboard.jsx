import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatRupees } from '../../api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/clinics'),
    ])
      .then(([s, c]) => {
        setStats(s);
        setClinics(c || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Admin dashboard</h1>
          <p className="muted">Manage master catalogs and monitor clinic activity</p>
        </div>
        <div className="row">
          <Link className="button secondary" to="/admin/specialties">Specialties</Link>
          <Link className="button secondary" to="/admin/medicines">Medicines</Link>
          <Link className="button" to="/admin/reports">View reports</Link>
        </div>
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading dashboard…</p>}

      {stats && (
        <div className="row" style={{ marginTop: '1rem', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="card">
            <div className="small muted">Clinics</div>
            <h2 style={{ fontSize: '1.8rem', margin: '.2rem 0' }}>{stats.clinics}</h2>
            <span className="small muted">Registered clinics</span>
          </div>
          <div className="card">
            <div className="small muted">Specialties</div>
            <h2 style={{ fontSize: '1.8rem', margin: '.2rem 0' }}>{stats.specialties}</h2>
            <Link className="small" to="/admin/specialties">Manage specialties →</Link>
          </div>
          <div className="card">
            <div className="small muted">Medicines</div>
            <h2 style={{ fontSize: '1.8rem', margin: '.2rem 0' }}>{stats.medicines}</h2>
            <Link className="small" to="/admin/medicines">Manage medicines →</Link>
          </div>
          <div className="card">
            <div className="small muted">Doctors / Patients</div>
            <h2 style={{ fontSize: '1.8rem', margin: '.2rem 0' }}>{stats.doctors} / {stats.patients}</h2>
            <span className="small muted">Registered accounts</span>
          </div>
          <div className="card">
            <div className="small muted">Active Bookings</div>
            <h2 style={{ fontSize: '1.8rem', margin: '.2rem 0' }}>{stats.activeBookings}</h2>
            <span className="small muted">Status: BOOKED</span>
          </div>
          <div className="card">
            <div className="small muted">Net Revenue</div>
            <h2 style={{ fontSize: '1.8rem', margin: '.2rem 0' }}>{formatRupees(stats.netRevenue)}</h2>
            <span className="small muted">Completed visits</span>
          </div>
        </div>
      )}

      <h2>Clinics overview</h2>
      <p className="small muted">Clinics registered on MediSlot by doctors</p>

      {clinics.length === 0 && !loading && (
        <p className="muted">No clinics registered yet.</p>
      )}

      {clinics.length > 0 && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '.9rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg)' }}>
                <th style={{ padding: '.6rem .8rem' }}>Name</th>
                <th style={{ padding: '.6rem .8rem' }}>City</th>
                <th style={{ padding: '.6rem .8rem' }}>Address</th>
                <th style={{ padding: '.6rem .8rem' }}>Doctors</th>
              </tr>
            </thead>
            <tbody>
              {clinics.map((c) => (
                <tr key={c.clinic_id} style={{ borderBottom: '1px solid var(--line)' }}>
                  <td style={{ padding: '.6rem .8rem', fontWeight: 600 }}>{c.name}</td>
                  <td style={{ padding: '.6rem .8rem' }}>{c.city}</td>
                  <td style={{ padding: '.6rem .8rem' }} className="muted">{c.address || '—'}</td>
                  <td style={{ padding: '.6rem .8rem' }}>{c.doctor_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
