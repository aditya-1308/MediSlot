// MediSlot | client/src/pages/admin/SpecialtiesAdmin.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api';
import './admin.css';

const EMPTY_FORM = { name: '' };

export default function SpecialtiesAdmin() {
  const [specialties, setSpecialties] = useState(null);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function load() {
    setError('');
    api.get('/admin/specialties')
      .then(setSpecialties)
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  function openAdd() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setError('');
    setNotice('');
  }

  function openEdit(spec) {
    setEditingId(spec.specialty_id);
    setForm({
      name: spec.name || '',
    });
    setShowForm(true);
    setConfirmDeleteId(null);
    setError('');
    setNotice('');
  }

  function cancelForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (editingId) {
        await api.put(`/admin/specialties/${editingId}`, form);
        setNotice(`Updated specialty "${form.name}".`);
      } else {
        await api.post('/admin/specialties', form);
        setNotice(`Added specialty "${form.name}".`);
      }
      cancelForm();
      load();
    } catch (err) {
      setError(`${err.rule ? err.rule + ': ' : ''}${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(spec) {
    setError('');
    setNotice('');
    try {
      await api.del(`/admin/specialties/${spec.specialty_id}`);
      setNotice(`Deleted specialty "${spec.name}".`);
      setConfirmDeleteId(null);
      if (editingId === spec.specialty_id) cancelForm();
      load();
    } catch (err) {
      setError(`${err.rule ? err.rule + ': ' : ''}${err.message}`);
      setConfirmDeleteId(null);
    }
  }

  const filtered = specialties?.filter((s) => {
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q);
  });

  return (
    <div className="page">
      <div className="pagehead">
        <h1>Specialties</h1>
        {!showForm && (
          <button onClick={openAdd}>+ Add specialty</button>
        )}
      </div>

      {notice && (
        <p className="notice">
          {notice} <button className="link" onClick={() => setNotice('')}>Dismiss</button>
        </p>
      )}
      {error && <p className="error">{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} className="card form">
          <h2>{editingId ? 'Edit specialty' : 'Add new specialty'}</h2>
          <label>
            Specialty name *
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g., Cardiology"
              required
            />
          </label>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="secondary" onClick={cancelForm} disabled={busy}>
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create specialty'}
            </button>
          </div>
        </form>
      )}

      <div className="admin-toolbar">
        <input
          className="admin-search"
          type="search"
          placeholder="Search specialties…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {filtered && (
          <span className="muted small">
            Showing {filtered.length} of {specialties.length} specialties
          </span>
        )}
      </div>

      {!specialties && !error && <p className="muted">Loading specialties…</p>}

      {filtered && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Specialty</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="3" className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    No specialties found.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => (
                  <tr key={s.specialty_id}>
                    <td className="muted">#{s.specialty_id}</td>
                    <td><strong>{s.name}</strong></td>
                    <td className="actions-cell">
                      {confirmDeleteId === s.specialty_id ? (
                        <>
                          <span className="small">Delete?</span>
                          <button className="danger btn-sm" onClick={() => handleDelete(s)}>
                            Yes, delete
                          </button>
                          <button className="link" onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="secondary btn-sm" onClick={() => openEdit(s)}>
                            Edit
                          </button>
                          <button
                            className="danger btn-sm"
                            onClick={() => setConfirmDeleteId(s.specialty_id)}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}