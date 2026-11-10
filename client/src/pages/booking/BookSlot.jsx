// Workflow W1: confirm a slot and pay (simulated). The whole booking is one
// call to sp_book_appointment; if it fails, nothing was saved and the
// database's own message (R1 slot taken, R3 clash, R9 started) is shown.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, formatRupees, formatWhen } from '../../api';

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
  if (!slot) return <div className="page narrow"><p className="muted">Loading slot…</p></div>;

  const started = new Date(slot.slot_start) <= new Date();

  return (
    <div className="page narrow">
      <p className="muted"><Link to="/search">← Back to search</Link></p>
      <h1>Book appointment</h1>

      <section className="card">
        <h2>{slot.doctor_name}</h2>
        <p className="muted">{slot.specialty} · {slot.experience_yrs} yrs experience</p>
        <dl className="facts">
          <dt>When</dt><dd>{formatWhen(slot.slot_start)} – {new Date(slot.slot_end).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })}</dd>
          <dt>Where</dt><dd>{slot.clinic_name}, {slot.clinic_address}, {slot.city}</dd>
          <dt>Fee</dt><dd><strong>{formatRupees(slot.fee)}</strong></dd>
          <dt>Slot</dt><dd><span className={`pill ${slot.status.toLowerCase()}`}>{slot.status}</span></dd>
        </dl>
      </section>

      <form className="card form" onSubmit={pay}>
        <h2>Payment</h2>
        <fieldset className="methods" disabled={stage === 'paying'}>
          {METHODS.map((m) => (
            <label key={m.value} className={`method ${method === m.value ? 'on' : ''}`}>
              <input type="radio" name="method" value={m.value} checked={method === m.value} onChange={() => setMethod(m.value)} />
              {m.label}
            </label>
          ))}
        </fieldset>
        <label>Reason for visit (optional)
          <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} disabled={stage === 'paying'} />
        </label>
        <p className="muted small">
          Cancellation: full refund 24 h or more before, 50% from 2 to 24 h, nothing under 2 h.
        </p>
        {error && (
          <p className="error">
            {error.rule && <span className="rule">{error.rule}</span>} {error.message}
          </p>
        )}
        <button disabled={stage === 'paying'}>
          {stage === 'paying' ? 'Processing payment…' : `Pay ${formatRupees(slot.fee)} and book`}
        </button>
        {(slot.status !== 'FREE' || started) && (
          <p className="muted small">
            This slot looks {started ? 'already started' : 'taken'}; you can still try, and the database will decide.
          </p>
        )}
      </form>
    </div>
  );
}
