import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatWhen } from '../../api';

const WEEKDAYS = [
  [1, 'Monday'],
  [2, 'Tuesday'],
  [3, 'Wednesday'],
  [4, 'Thursday'],
  [5, 'Friday'],
  [6, 'Saturday'],
  [7, 'Sunday'],
];

const WEEKDAY_NAME = Object.fromEntries(WEEKDAYS);
const SLOT_DURATIONS = [10, 15, 20, 30, 45, 60];

function istDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

function istTime(ts) {
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(ts));
}

export default function Schedule() {
  const [availability, setAvailability] = useState([]);
  const [slots, setSlots] = useState([]);

  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [slotMinutes, setSlotMinutes] = useState(30);

  const [genStart, setGenStart] = useState(() => istDate(0));
  const [genEnd, setGenEnd] = useState(() => istDate(6));
  const [slotDate, setSlotDate] = useState(() => istDate(0));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState('');

  const loadAvailability = useCallback(async () => {
    const data = await api.get('/doctor/availability');
    setAvailability(data.availability || []);
  }, []);

  const loadSlots = useCallback(async (date) => {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    const data = await api.get(`/doctor/slots${qs}`);
    setSlots(data.slots || []);
  }, []);

  useEffect(() => {
    loadAvailability().catch(setError);
  }, [loadAvailability]);

  useEffect(() => {
    loadSlots(slotDate).catch(setError);
  }, [slotDate, loadSlots]);

  async function addWindow(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await api.post('/doctor/availability', {
        weekday: Number(weekday),
        startTime,
        endTime,
        slotMinutes: Number(slotMinutes),
      });
      setNotice('Availability window added.');
      await loadAvailability();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function removeWindow(availId) {
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await api.del(`/doctor/availability/${availId}`);
      setNotice('Availability window removed.');
      await loadAvailability();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function generateSlots(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const data = await api.post('/doctor/slots/generate', {
        startDate: genStart,
        endDate: genEnd,
      });
      setNotice(`Generated ${data.created} new slot(s).`);
      await loadSlots(slotDate);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  async function toggleBlock(slotId, block) {
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await api.patch(`/doctor/slots/${slotId}/block`, { block });
      setNotice(block ? 'Slot blocked.' : 'Slot unblocked.');
      await loadSlots(slotDate);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <div className="pagehead">
        <div>
          <h1>Availability &amp; Slots</h1>
          <p className="muted">Configure weekly consultation windows and generate bookable slots.</p>
        </div>
        <Link className="button secondary" to="/doctor">
          Back to appointments
        </Link>
      </div>

      {error && (
        <p className="error">
          {error.rule && <span className="rule">{error.rule}</span>} {error.message}
        </p>
      )}
      {notice && <p className="notice">{notice}</p>}

      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <form className="card form" onSubmit={addWindow} style={{ flex: '1 1 320px' }}>
          <h2>Add Weekly Window</h2>
          <label>
            Weekday
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
              {WEEKDAYS.map(([num, name]) => (
                <option key={num} value={num}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <div className="row">
            <label style={{ flex: 1 }}>
              Start time
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </label>
            <label style={{ flex: 1 }}>
              End time
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Slot length (minutes)
            <select value={slotMinutes} onChange={(e) => setSlotMinutes(Number(e.target.value))}>
              {SLOT_DURATIONS.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={busy}>
            Save window
          </button>
        </form>

        <form className="card form" onSubmit={generateSlots} style={{ flex: '1 1 280px' }}>
          <h2>Generate Slots</h2>
          <label>
            From date
            <input
              type="date"
              value={genStart}
              onChange={(e) => setGenStart(e.target.value)}
              required
            />
          </label>
          <label>
            To date
            <input
              type="date"
              value={genEnd}
              onChange={(e) => setGenEnd(e.target.value)}
              required
            />
          </label>
          <button type="submit" disabled={busy}>
            Generate slots
          </button>
        </form>
      </div>

      <h2 style={{ marginTop: '1.5rem' }}>Weekly Windows</h2>
      {availability.length === 0 ? (
        <div className="card">
          <p className="muted">No weekly availability windows configured yet.</p>
        </div>
      ) : (
        <div className="appts">
          {availability.map((w) => (
            <div key={w.avail_id} className="appt card">
              <div>
                <strong>{WEEKDAY_NAME[w.weekday] || `Day ${w.weekday}`}</strong>
                <p className="small muted">
                  {w.start_time} – {w.end_time} · {w.slot_minutes} min slots
                </p>
              </div>
              <div className="right">
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={() => removeWindow(w.avail_id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="pagehead" style={{ marginTop: '1.5rem' }}>
        <h2>Slots for Date</h2>
        <input
          type="date"
          value={slotDate}
          onChange={(e) => setSlotDate(e.target.value)}
        />
      </div>

      {slots.length === 0 ? (
        <div className="card">
          <p className="muted">No slots generated for {slotDate}.</p>
        </div>
      ) : (
        <div className="appts">
          {slots.map((s) => (
            <div key={s.slot_id} className="appt card">
              <div>
                <div className="when">
                  {formatWhen(s.slot_start)} – {istTime(s.slot_end)}
                </div>
              </div>
              <div className="right">
                <span className={`pill ${s.status.toLowerCase()}`}>{s.status}</span>
                {s.status === 'FREE' && (
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => toggleBlock(s.slot_id, true)}
                  >
                    Block
                  </button>
                )}
                {s.status === 'BLOCKED' && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleBlock(s.slot_id, false)}
                  >
                    Unblock
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
