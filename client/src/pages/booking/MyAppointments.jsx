// Patient's upcoming appointments, with cancellation. Before cancelling, the
// refund the database would give right now (fn_refund_amount via the view)
// is shown; after cancelling, the refund sp_cancel_appointment actually made.
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, dateParts, formatRupees, formatWhen } from '../../api';

const METHOD_LABEL = { UPI: 'UPI', CARD: 'card', NETBANKING: 'net banking', CASH: 'cash at clinic' };

function EmptyState({ when }) {
  return (
    <div className="card empty">
      <div className="icon" aria-hidden="true">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
      </div>
      <strong>No {when === 'all' ? '' : when} appointments</strong>
      <p className="muted">{when === 'past' ? 'Visits you have had will show up here.' : 'Find a doctor and book a free slot in under a minute.'}</p>
      {when !== 'past' && <Link className="button" to="/search">Find a doctor</Link>}
    </div>
  );
}

export default function MyAppointments() {
  const location = useLocation();
  const [when, setWhen] = useState('upcoming');
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [notice, setNotice] = useState(
    location.state?.booked
      ? `Booked with ${location.state.booked.doctor_name} for ${formatWhen(location.state.booked.slot_start)}. Paid ${formatRupees(location.state.booked.amount)}.`
      : ''
  );

  function load() {
    setError('');
    setRows(null);
    api.get(`/booking/mine?when=${when}`).then(setRows).catch((e) => setError(e.message));
  }
  useEffect(load, [when]);

  async function cancel(appt) {
    setError('');
    try {
      const { refund, appointment } = await api.post(`/booking/${appt.appt_id}/cancel`);
      setNotice(
        `Cancelled ${appointment.doctor_name} on ${formatWhen(appointment.slot_start)}. ` +
        `Refund ${formatRupees(refund)} of ${formatRupees(appointment.amount)} (${appointment.payment_status.replace('_', ' ').toLowerCase()}).`
      );
      setConfirming(null);
      load();
    } catch (err) {
      setError(`${err.rule ? err.rule + ': ' : ''}${err.message}`);
      setConfirming(null);
      load();
    }
  }

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>My appointments</h1>
          <p className="subtitle" style={{ margin: '.25rem 0 0' }}>Your bookings, payments and refunds in one place.</p>
        </div>
        <Link className="button" to="/search">+ Book a visit</Link>
      </div>

      <div className="tabs" role="tablist">
        {['upcoming', 'past', 'all'].map((w) => (
          <button key={w} role="tab" aria-selected={when === w} className={when === w ? 'on' : ''} onClick={() => setWhen(w)}>{w}</button>
        ))}
      </div>

      {notice && <p className="notice"><span>{notice}</span> <button className="link" onClick={() => setNotice('')}>Dismiss</button></p>}
      {error && <p className="error">{error}</p>}
      {!rows && !error && <div className="appts"><div className="skeleton" /><div className="skeleton" /></div>}
      {rows && rows.length === 0 && <EmptyState when={when} />}

      <ul className="appts">
        {rows?.map((a) => {
          const d = dateParts(a.slot_start);
          return (
            <li key={a.appt_id} className={`card appt ${a.status === 'CANCELLED' ? 'is-cancelled' : ''}`}>
              <div className="main">
                <div className="datetile"><span className="m">{d.month}</span><span className="d">{d.day}</span></div>
                <div>
                  <div className="when">{d.weekday}, {d.time}</div>
                  <div><strong>{a.doctor_name}</strong> <span className="muted">· {a.specialty}</span></div>
                  <div className="muted small">{a.clinic_name}, {a.city}</div>
                  {a.reason && <div className="muted small">“{a.reason}”</div>}
                </div>
              </div>
              <div className="right">
                <span className={`pill ${a.status.toLowerCase()}`}>{a.status.replace('_', ' ')}</span>
                <div className="small">
                  Paid <strong>{formatRupees(a.amount)}</strong> by {METHOD_LABEL[a.method] || a.method}
                  {Number(a.refund_amount) > 0 && <> · refunded <strong>{formatRupees(a.refund_amount)}</strong></>}
                </div>
                {a.refund_if_cancelled_now !== null && (
                  confirming === a.appt_id ? (
                    <div className="confirm">
                      <span className="small">Refund if cancelled now: <strong>{formatRupees(a.refund_if_cancelled_now)}</strong></span>
                      <button className="danger" onClick={() => cancel(a)}>Yes, cancel</button>
                      <button className="link" onClick={() => setConfirming(null)}>Keep it</button>
                    </div>
                  ) : (
                    <button className="secondary" onClick={() => setConfirming(a.appt_id)}>
                      Cancel · refund {formatRupees(a.refund_if_cancelled_now)}
                    </button>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
