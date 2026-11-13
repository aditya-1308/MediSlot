import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api';

export default function Specialties() {
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.get('/admin/specialties')
      .then(setList)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function addSpecialty(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setBusy(true);
    try {
      await api.post('/admin/specialties', { name: name.trim() });
      setName('');
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id, sname) {
    if (!window.confirm(`Delete specialty "${sname}"?`)) return;
    setError('');
    try {
      await api.del(`/admin/specialties/${id}`);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page narrow">
      <div className="pagehead">
        <div>
          <h1>Specialties</h1>
          <p className="muted">Manage medical specialties in the catalogue</p>
        </div>
        <Link className="button secondary" to="/admin">← Dashboard</Link>
      </div>

      <form onSubmit={addSpecialty} className="card form" style={{ marginBottom: '1.5rem' }}>
        <h2>Add new specialty</h2>
        <div className="row">
          <label>
            Name
            <input
              type="text"
              placeholder="e.g. Cardiology"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button disabled={busy}>{busy ? 'Adding…' : 'Add specialty'}</button>
          </div>
        </div>
      </form>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading specialties…</p>}

      <div className="card" style={{ padding: 0 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.9rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg)', textAlign: 'left' }}>
              <th style={{ padding: '.6rem .8rem' }}>ID</th>
              <th style={{ padding: '.6rem .8rem' }}>Name</th>
              <th style={{ padding: '.6rem .8rem', textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.specialty_id} style={{ borderBottom: '1px solid var(--line)' }}>
                <td style={{ padding: '.6rem .8rem', color: 'var(--muted)' }}>#{s.specialty_id}</td>
                <td style={{ padding: '.6rem .8rem', fontWeight: 500 }}>{s.name}</td>
                <td style={{ padding: '.6rem .8rem', textAlign: 'right' }}>
                  <button
                    className="danger"
                    style={{ padding: '.25rem .6rem', fontSize: '.8rem' }}
                    onClick={() => remove(s.specialty_id, s.name)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && !loading && (
              <tr>
                <td colSpan={3} style={{ padding: '1rem', textAlign: 'center' }} className="muted">
                  No specialties found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
