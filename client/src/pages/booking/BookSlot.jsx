// Workflow W1: confirm a slot and pay (simulated). The whole booking is one
// call to sp_book_appointment; if it fails, nothing was saved and the
// database's own message (R1 slot taken, R3 clash, R9 started) is shown.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, dateParts, formatRupees, initials } from '../../api';

const METHODS = [
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'NETBANKING', label: 'Net banking' },
  { value: 'CASH', label: 'Pay at clinic' },
];

export default function BookSlot() {
  const { slotId } = useParams();
  const navigate = useNavigate();
  const [slot, setSlot] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [method, setMethod] = useState('UPI');
  const [reason, setReason] = useState('');
  const [stage, setStage] = useState('form'); // form | paying
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/booking/slots/${slotId}`).then(setSlot).catch((e) => setLoadError(e.message));
  }, [slotId]);

  async function pay(e) {
    e.preventDefault();
    setError(null);
    setStage('paying');
    // Simulated gateway: a short pause, then the real booking transaction
    await new Promise((r) => setTimeout(r, 900));
    try {
      const appt = await api.post('/booking', { slotId: Number(slotId), method, reason });
      navigate('/appointments', { state: { booked: appt } });
    } catch (err) {
      setError(err);
      setStage('form');
      // Refresh so the page shows the slot's real status after a clash
      api.get(`/booking/slots/${slotId}`).then(setSlot).catch(() => {});
    }
  }

  if (loadError) return <div className="page narrow"><p className="error">{loadError}</p></div>;
  if (!slot) return <div className="page"><div className="skeleton" style={{ height: 260 }} /></div>;

  const started = new Date(slot.slot_start) <= new Date();
  const start = dateParts(slot.slot_start);
  const end = dateParts(slot.slot_end);
  const paying = stage === 'paying';

  return (
    <div className="page">
      <Link className="backlink" to="/search">← Back to search</Link>
      <h1>Book appointment</h1>

      <div className="book-grid">
        <div>
          <section className="card">
            <div className="doctor-head">
              <span className="avatar">{initials(slot.doctor_name)}</span>
              <div>
                <h2>{slot.doctor_name}</h2>
                <div className="muted small">{slot.specialty} · {slot.experience_yrs} yrs experience</div>
              </div>
              <span style={{ marginLeft: 'auto' }} className={`pill ${slot.status.toLowerCase()}`}>{slot.status}</span>
            </div>
            <dl className="facts">
              <dt>Date</dt><dd>{start.weekday}, {start.day} {start.month}</dd>
              <dt>Time</dt><dd>{start.time} – {end.time}</dd>
              <dt>Clinic</dt><dd>{slot.clinic_name}</dd>
              <dt>Address</dt><dd>{slot.clinic_address}, {slot.city}</dd>
            </dl>
          </section>

          <section className="card">
            <h2>Cancellation policy</h2>
            <p className="muted small" style={{ marginTop: 0 }}>Refunds are worked out by the database at the moment you cancel.</p>
            <div className="policy">
              <div><b>100%</b>24 h or more before</div>
              <div><b>50%</b>2 to 24 h before</div>
              <div><b>0%</b>under 2 h</div>
            </div>
          </section>
        </div>

        <form className="card form summary" onSubmit={pay}>
          <h2>Payment</h2>
          <fieldset className="methods" disabled={paying}>
            {METHODS.map((m) => (
              <label key={m.value} className={`method ${method === m.value ? 'on' : ''}`}>
                <input type="radio" name="method" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} />
                {m.label}
              </label>
            ))}
          </fieldset>
          <label><span>Reason for visit <span className="muted small">(optional)</span></span>
            <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} disabled={paying} placeholder="e.g. follow-up, chest pain, routine check-up" />
          </label>
          <div className="total">
            <span className="muted">Consultation fee</span>
            <strong>{formatRupees(slot.fee)}</strong>
          </div>
          {error && (
            <p className="error">
              {error.rule && <span className="rule">{error.rule}</span>}{error.message}
            </p>
          )}
          <button className="block" disabled={paying}>
            {paying ? <><span className="spinner" /> Processing payment…</> : `Pay ${formatRupees(slot.fee)} and book`}
          </button>
          {(slot.status !== 'FREE' || started) && (
            <p className="muted small" style={{ margin: 0 }}>
              This slot looks {started ? 'already started' : 'taken'}; you can still try, and the database will decide.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
