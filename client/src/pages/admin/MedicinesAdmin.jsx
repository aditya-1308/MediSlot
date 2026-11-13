// MediSlot | client/src/pages/admin/MedicinesAdmin.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api';
import './admin.css';

const DOSAGE_FORMS = ['TABLET', 'CAPSULE', 'SYRUP', 'INJECTION', 'OINTMENT', 'DROPS', 'OTHER'];
const EMPTY_FORM = { name: '', form: 'TABLET', strength: '' };

export default function MedicinesAdmin() {
  const [medicines, setMedicines] = useState(null);
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
    api.get('/admin/medicines')
      .then(setMedicines)
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

  function openEdit(med) {
    setEditingId(med.medicine_id);
    setForm({
      name: med.name || '',
      form: med.form || 'TABLET',
      strength: med.strength || '',
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
        await api.put(`/admin/medicines/${editingId}`, form);
        setNotice(`Updated medicine "${form.name}".`);
      } else {
        await api.post('/admin/medicines', form);
        setNotice(`Added medicine "${form.name}".`);
      }
      cancelForm();
      load();
    } catch (err) {
      setError(`${err.rule ? err.rule + ': ' : ''}${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(med) {
    setError('');
    setNotice('');
    try {
      await api.del(`/admin/medicines/${med.medicine_id}`);
      setNotice(`Deleted medicine "${med.name}".`);
      setConfirmDeleteId(null);
      if (editingId === med.medicine_id) cancelForm();
      load();
    } catch (err) {
      setError(`${err.rule ? err.rule + ': ' : ''}${err.message}`);
      setConfirmDeleteId(null);
    }
  }

  const filtered = medicines?.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page">
      <div className="pagehead">
        <h1>Medicines catalog</h1>
        {!showForm && (
          <button onClick={openAdd}>+ Add medicine</button>
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
          <h2>{editingId ? 'Edit medicine' : 'Add new medicine'}</h2>
          <div className="row">
            <label>
              Medicine name *
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Dolo 650"
                required
              />
            </label>
          </div>
          <div className="row">
            <label>
              Dosage form *
              <select
                value={form.form}
                onChange={(e) => setForm({ ...form, form: e.target.value })}
                required
              >
                {DOSAGE_FORMS.map((f) => (
                  <option key={f} value={f}>{f[0] + f.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </label>
            <label>
              Strength *
              <input
                value={form.strength}
                onChange={(e) => setForm({ ...form, strength: e.target.value })}
                placeholder="e.g., 650 mg"
                required
              />
            </label>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="secondary" onClick={cancelForm} disabled={busy}>
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create medicine'}
            </button>
          </div>
        </form>
      )}

      <div className="admin-toolbar">
        <input
          className="admin-search"
          type="search"
          placeholder="Search medicines…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {filtered && (
          <span className="muted small">
            Showing {filtered.length} of {medicines.length} medicines
          </span>
        )}
      </div>

      {!medicines && !error && <p className="muted">Loading medicines…</p>}

      {filtered && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Medicine</th>
                <th>Form &amp; Strength</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="4" className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    No medicines found.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.medicine_id}>
                    <td className="muted">#{m.medicine_id}</td>
                    <td><strong>{m.name}</strong></td>
                    <td>
                      <span className="pill">{m.form}</span>{' '}
                      <span className="small">{m.strength}</span>
                    </td>
                    <td className="actions-cell">
                      {confirmDeleteId === m.medicine_id ? (
                        <>
                          <span className="small">Delete?</span>
                          <button className="danger btn-sm" onClick={() => handleDelete(m)}>
                            Yes, delete
                          </button>
                          <button className="link" onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="secondary btn-sm" onClick={() => openEdit(m)}>
                            Edit
                          </button>
                          <button
                            className="danger btn-sm"
                            onClick={() => setConfirmDeleteId(m.medicine_id)}
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