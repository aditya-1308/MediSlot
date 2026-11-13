// Patient's upcoming appointments, with cancellation. Before cancelling, the
// refund the database would give right now (fn_refund_amount via the view)
// is shown; after cancelling, the refund sp_cancel_appointment actually made.
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, formatRupees, formatWhen } from '../../api';

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
        <h1>My appointments</h1>
        <Link className="button" to="/search">Find a doctor</Link>
      </div>

      <div className="tabs">
        {['upcoming', 'past', 'all'].map((w) => (
          <button key={w} className={when === w ? 'on' : ''} onClick={() => setWhen(w)}>{w}</button>
        ))}
      </div>

      {notice && <p className="notice">{notice} <button className="link" onClick={() => setNotice('')}>Dismiss</button></p>}
      {error && <p className="error">{error}</p>}
      {!rows && !error && <p className="muted">Loading…</p>}
      {rows && rows.length === 0 && <p className="muted">No {when === 'all' ? '' : when} appointments.</p>}

      <ul className="appts">
        {rows?.map((a) => (
          <li key={a.appt_id} className="card appt">
            <div>
              <div className="when">{formatWhen(a.slot_start)}</div>
              <div><strong>{a.doctor_name}</strong> · {a.specialty}</div>
              <div className="muted">{a.clinic_name}, {a.city}</div>
              {a.reason && <div className="muted small">“{a.reason}”</div>}
            </div>
            <div className="right">
              <span className={`pill ${a.status.toLowerCase()}`}>{a.status.replace('_', ' ')}</span>
              {a.status === 'COMPLETED' && (
                <Link className="button secondary" to={`/visits/${a.appt_id}/prescription`}>
                  Prescription & Review
                </Link>
              )}
              <div className="small">
                Paid {formatRupees(a.amount)} by {a.method}
                {Number(a.refund_amount) > 0 && <> · refunded {formatRupees(a.refund_amount)}</>}
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
        ))}
      </ul>
    </div>
  );
}
