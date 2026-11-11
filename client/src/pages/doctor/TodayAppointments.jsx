import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatRupees, formatWhen } from '../../api';

const VIEWS = [
  ['today', 'Today'],
  ['upcoming', 'Upcoming'],
  ['past', 'Past'],
  ['all', 'All'],
];

function shortDate(value) {
  return value ? String(value).slice(0, 10) : '';
}

export default function TodayAppointments() {
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [view, setView] = useState('today');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');

  const loadAppointments = useCallback(async (nextView, nextDate) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ view: nextView });
      if (nextDate) qs.set('date', nextDate);
      const data = await api.get(`/doctor/appointments?${qs.toString()}`);
      setAppointments(data.appointments || []);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api.get('/doctor/profile').then((d) => setProfile(d.profile)).catch(() => {});
  }, []);

  useEffect(() => {
    loadAppointments(view, dateFilter);
  }, [view, dateFilter, loadAppointments]);

  async function updateStatus(apptId, status) {
    setBusyId(apptId);
    setError(null);
    setNotice('');
    try {
      await api.patch(`/doctor/appointments/${apptId}/status`, { status });
      setNotice(`Appointment #${apptId} marked ${status}.`);
      await loadAppointments(view, dateFilter);
    } catch (err) {
      setError(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="page">
      <div className="pagehead">
        <div>
          <h1>
            {profile
              ? (/^Dr\.?\s/i.test(profile.full_name) ? profile.full_name : `Dr. ${profile.full_name}`)
              : 'Doctor Appointments'}
          </h1>
          {profile && (
            <p className="muted">
              {profile.specialty} · {profile.clinic_name}, {profile.city} · Fee {formatRupees(profile.fee)}
            </p>
          )}
        </div>
        <Link className="button secondary" to="/doctor/schedule">
          Manage availability
        </Link>
      </div>

      <div className="row" style={{ alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {VIEWS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={!dateFilter && view === key ? 'on' : ''}
              onClick={() => {
                setDateFilter('');
                setView(key);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <label className="small muted" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          Date
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </label>
        {dateFilter && (
          <button type="button" className="secondary" onClick={() => setDateFilter('')}>
            Clear date
          </button>
        )}
      </div>

      {error && (
        <p className="error">
          {error.rule && <span className="rule">{error.rule}</span>} {error.message}
        </p>
      )}
      {notice && <p className="notice">{notice}</p>}

      {loading ? (
        <p className="muted">Loading appointments...</p>
      ) : appointments.length === 0 ? (
        <div className="card">
          <p className="muted">
            No appointments found for this filter. Check Upcoming or All if seeded visits are on another date.
          </p>
        </div>
      ) : (
        <div className="appts">
          {appointments.map((a) => (
            <article key={a.appt_id} className="appt card">
              <div>
                <div className="when">{formatWhen(a.slot_start)}</div>
                <strong>{a.patient_name}</strong>
                <p className="small muted">
                  {[a.patient_gender, shortDate(a.patient_dob), a.patient_phone].filter(Boolean).join(' · ')}
                </p>
                {a.reason && <p className="small">{a.reason}</p>}
              </div>

              <div className="right">
                <span className={`pill ${a.status.toLowerCase()}`}>{a.status.replace('_', ' ')}</span>

                {a.status === 'BOOKED' && (
                  <div className="row">
                    <button
                      type="button"
                      disabled={busyId === a.appt_id}
                      onClick={() => updateStatus(a.appt_id, 'COMPLETED')}
                    >
                      Mark completed
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busyId === a.appt_id}
                      onClick={() => updateStatus(a.appt_id, 'NO_SHOW')}
                    >
                      No-show
                    </button>
                  </div>
                )}

                {a.status === 'COMPLETED' && (
                  <Link className="button secondary" to={`/visits/${a.appt_id}/prescription`}>
                    {a.has_prescription ? 'Edit prescription' : 'Write prescription'}
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
