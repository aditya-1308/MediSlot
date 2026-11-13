import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

const FORMS = ['TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'OINTMENT', 'DROPS', 'OTHER'];

export default function Medicines() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ name: '', form: 'TABLET', strength: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/admin/medicines')
      .then(setList)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function addMedicine(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setError('');
    setBusy(true);
    try {
      await api.post('/admin/medicines', {
        name: form.name.trim(),
        form: form.form,
        strength: form.strength.trim() || null,
      });
      setForm({ name: '', form: 'TABLET', strength: '' });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id, mname) {
    if (!window.confirm(`Delete medicine "${mname}"?`)) return;
    setError('');
    try {
      await api.del(`/admin/medicines/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Medicines catalogue</h1>
          <p className="muted">Master list of prescribed medicines</p>
        </div>
        <Link className="button secondary" to="/admin">← Dashboard</Link>
      </div>

      <form onSubmit={addMedicine} className="card form" style={{ marginBottom: '1.5rem' }}>
        <h2>Add medicine</h2>
        <div className="row">
          <label style={{ flex: 2 }}>
            Medicine name
            <input
              type="text"
              placeholder="e.g. Paracetamol"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label style={{ flex: 1 }}>
            Form
            <select
              value={form.form}
              onChange={(e) => setForm({ ...form, form: e.target.value })}
            >
              {FORMS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1 }}>
            Strength
            <input
              type="text"
              placeholder="e.g. 500mg, 10ml"
              value={form.strength}
              onChange={(e) => setForm({ ...form, strength: e.target.value })}
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button disabled={busy}>{busy ? 'Adding…' : 'Add medicine'}</button>
          </div>
        </div>
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading medicines…</p>}

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg)', textAlign: 'left' }}>
              <th style={{ padding: '.6rem .8rem' }}>ID</th>
              <th style={{ padding: '.6rem .8rem' }}>Name</th>
              <th style={{ padding: '.6rem .8rem' }}>Form</th>
              <th style={{ padding: '.6rem .8rem' }}>Strength</th>
              <th style={{ padding: '.6rem .8rem', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.medicine_id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '.6rem .8rem', color: 'var(--muted)' }}>#{m.medicine_id}</td>
                <td style={{ padding: '.6rem .8rem', fontWeight: 600 }}>{m.name}</td>
                <td style={{ padding: '.6rem .8rem' }}>
                  <span className="pill">{m.form}</span>
                </td>
                <td style={{ padding: '.6rem .8rem' }} className="muted">{m.strength || '—'}</td>
                <td style={{ padding: '.6rem .8rem', textAlign: 'right' }}>
                  <button
                    className="danger"
                    style={{ padding: '.25rem .6rem', fontSize: '.8rem' }}
                    onClick={() => remove(m.medicine_id, m.name)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{ padding: '1rem', textAlign: 'center' }} className="muted">
                  No medicines found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
