import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';

export default function Prescription() {
  const { apptId } = useParams();
  const { user } = useAuth();

  const [items, setItems] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Doctor add prescription state
  const [medId, setMedId] = useState('');
  const [dosage, setDosage] = useState('');
  const [daysSupply, setDaysSupply] = useState(7);
  const [busy, setBusy] = useState(false);

  // Patient review state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewDone, setReviewDone] = useState(false);

  function load() {
    setLoading(true);
    setError('');
    Promise.all([
      api.get(`/clinical/visits/${apptId}/prescription`),
      api.get('/clinical/medicines'),
    ])
      .then(([pItems, meds]) => {
        setItems(pItems || []);
        setMedicines(meds || []);
        if (meds && meds.length > 0 && !medId) {
          setMedId(meds[0].medicine_id);
        }
      })
      .catch((err) => {
        setError(`${err.rule ? err.rule + ': ' : ''}${err.message}`);
      })
      .finally(() => setLoading(false));
  }

  useEffect(load, [apptId]);

  async function addItem(e) {
    e.preventDefault();
    if (!medId) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await api.post(`/clinical/visits/${apptId}/prescription`, {
        medicineId: Number(medId),
        dosage: dosage.trim() || null,
        days_supply: Number(daysSupply) || null,
      });
      setDosage('');
      setDaysSupply(7);
      setNotice('Prescription item added.');
      load();
    } catch (err) {
      setError(`${err.rule ? err.rule + ': ' : ''}${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(medicineId) {
    if (!window.confirm('Remove this medicine from prescription?')) return;
    setError('');
    setNotice('');
    try {
      await api.del(`/clinical/visits/${apptId}/prescription/${medicineId}`);
      setNotice('Prescription item removed.');
      load();
    } catch (err) {
      setError(`${err.rule ? err.rule + ': ' : ''}${err.message}`);
    }
  }

  async function submitReview(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await api.post(`/clinical/visits/${apptId}/review`, {
        rating: Number(rating),
        comment: comment.trim() || null,
      });
      setReviewDone(true);
      setNotice('Review submitted successfully. Thank you!');
    } catch (err) {
      setError(`${err.rule ? err.rule + ': ' : ''}${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  const isDoctor = user?.role === 'DOCTOR';
  const isPatient = user?.role === 'PATIENT';

  return (
    <div className="page narrow">
      <div className="pagehead">
        <div>
          <h1>Prescription · Visit #{apptId}</h1>
          <p className="muted">
            {isDoctor ? 'Write and manage prescription items' : 'View your doctor’s prescription and share feedback'}
          </p>
        </div>
        <Link className="button secondary" to={isDoctor ? '/doctor' : '/appointments'}>
          ← {isDoctor ? 'Today\'s list' : 'My appointments'}
        </Link>
      </div>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading prescription details…</p>}

      {/* Prescription Items List */}
      <div className="card" style={{ padding: 0, overflowX: 'auto', marginBottom: '1.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg)', textAlign: 'left' }}>
              <th style={{ padding: '.6rem .8rem' }}>Medicine</th>
              <th style={{ padding: '.6rem .8rem' }}>Form / Strength</th>
              <th style={{ padding: '.6rem .8rem' }}>Dosage</th>
              <th style={{ padding: '.6rem .8rem' }}>Days</th>
              {isDoctor && <th style={{ padding: '.6rem .8rem', textAlign: 'right' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.medicine_id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '.6rem .8rem', fontWeight: 600 }}>{it.name}</td>
                <td style={{ padding: '.6rem .8rem' }} className="muted">
                  {it.form} {it.strength ? `(${it.strength})` : ''}
                </td>
                <td style={{ padding: '.6rem .8rem' }}>{it.dosage || '—'}</td>
                <td style={{ padding: '.6rem .8rem' }}>{it.days_supply || '—'}</td>
                {isDoctor && (
                  <td style={{ padding: '.6rem .8rem', textAlign: 'right' }}>
                    <button
                      className="danger"
                      style={{ padding: '.25rem .6rem', fontSize: '.8rem' }}
                      onClick={() => removeItem(it.medicine_id)}
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {items.length === 0 && !loading && (
              <tr>
                <td colSpan={isDoctor ? 5 : 4} style={{ padding: '1.2rem', textAlign: 'center' }} className="muted">
                  No prescription items recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Doctor Add Item Form */}
      {isDoctor && (
        <form onSubmit={addItem} className="card form">
          <h2>Add medicine to prescription</h2>
          <label>
            Medicine
            <select value={medId} onChange={(e) => setMedId(e.target.value)} required>
              {medicines.map((m) => (
                <option key={m.medicine_id} value={m.medicine_id}>
                  {m.name} ({m.form}{m.strength ? `, ${m.strength}` : ''})
                </option>
              ))}
            </select>
          </label>
          <div className="row">
            <label style={{ flex: 2 }}>
              Dosage instructions
              <input
                type="text"
                placeholder="e.g. 1 tablet twice daily after meals"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
              />
            </label>
            <label style={{ flex: 1 }}>
              Days supply
              <input
                type="number"
                min="1"
                max="365"
                value={daysSupply}
                onChange={(e) => setDaysSupply(e.target.value)}
                required
              />
            </label>
          </div>
          <button disabled={busy} style={{ alignSelf: 'flex-start' }}>
            {busy ? 'Adding…' : 'Add to prescription'}
          </button>
        </form>
      )}

      {/* Patient Review Form */}
      {isPatient && (
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <h2>Doctor visit review</h2>
          {reviewDone ? (
            <p className="notice">Your review has been recorded. Thank you!</p>
          ) : (
            <form onSubmit={submitReview} className="form">
              <label>
                Rating (1 to 5 stars)
                <select value={rating} onChange={(e) => setRating(e.target.value)}>
                  <option value="5">⭐⭐⭐⭐⭐ (5 - Excellent)</option>
                  <option value="4">⭐⭐⭐⭐ (4 - Very Good)</option>
                  <option value="3">⭐⭐⭐ (3 - Good)</option>
                  <option value="2">⭐⭐ (2 - Fair)</option>
                  <option value="1">⭐ (1 - Poor)</option>
                </select>
              </label>
              <label>
                Comments (optional)
                <textarea
                  rows="3"
                  placeholder="Share feedback on your consultation, wait time, or doctor care..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </label>
              <button disabled={busy} style={{ alignSelf: 'flex-start' }}>
                {busy ? 'Submitting…' : 'Submit review'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
