// MediSlot | client/src/pages/admin/DoctorsAdmin.jsx
import { useEffect, useState } from 'react';
import { api, formatRupees } from '../../api';
import './admin.css';

const EMPTY_FORM = {
  full_name: '',
  email: '',
  phone: '',
  password: '',
  specialty_id: '',
  license_no: '',
  fee: '500',
  experience_yrs: '0',
};

export default function DoctorsAdmin() {
  const [clinic, setClinic] = useState(null);
  const [doctors, setDoctors] = useState(null);
  const [specialties, setSpecialties] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function load() {
    setError('');
    Promise.all([api.get('/admin/doctors'), api.get('/admin/specialties')])
      .then(([docData, specList]) => {
        setClinic(docData.clinic);
        setDoctors(docData.doctors);
        setSpecialties(specList);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  function openAdd() {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      specialty_id: specialties[0]?.specialty_id ? String(specialties[0].specialty_id) : '',
    });
    setShowForm(true);
    setError('');
    setNotice('');
  }

  function openEdit(doc) {
    setEditingId(doc.doctor_id);
    setForm({
      full_name: doc.full_name || '',
      email: doc.email || '',
      phone: doc.phone || '',
      password: '',
      specialty_id: String(doc.specialty_id || ''),
      license_no: doc.license_no || '',
      fee: String(doc.fee ?? '500'),
      experience_yrs: String(doc.experience_yrs ?? '0'),
    });
    setShowForm(true);
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
        await api.put(`/admin/doctors/${editingId}`, form);
        setNotice(`Updated doctor "${form.full_name}".`);
      } else {
        await api.post('/admin/doctors', form);
        setNotice(`Added doctor "${form.full_name}".`);
      }
      cancelForm();
      load();
    } catch (err) {
      setError(`${err.rule ? err.rule + ': ' : ''}${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  const filtered = doctors?.filter((d) => {
    const q = search.toLowerCase();
    return (
      d.full_name.toLowerCase().includes(q) ||
      d.email.toLowerCase().includes(q) ||
      d.specialty_name.toLowerCase().includes(q) ||
      (d.license_no || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Doctors</h1>
          {clinic && (
            <p className="muted" style={{ marginTop: '-0.6rem' }}>
              {clinic.name} · {clinic.city}
            </p>
          )}
        </div>
        {!showForm && (
          <button onClick={openAdd}>+ Add doctor</button>
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
          <h2>{editingId ? 'Edit doctor' : 'Add new doctor'}</h2>
          <div className="row">
            <label>
              Doctor name *
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="e.g., Dr. Ananya Sharma"
                required
              />
            </label>
            <label>
              Email *
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="doctor@medislot.in"
                required
              />
            </label>
            <label>
              Phone
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="e.g., 9876543210"
              />
            </label>
          </div>
          <div className="row">
            <label>
              Specialty *
              <select
                value={form.specialty_id}
                onChange={(e) => setForm({ ...form, specialty_id: e.target.value })}
                required
              >
                <option value="">Select specialty…</option>
                {specialties.map((s) => (
                  <option key={s.specialty_id} value={s.specialty_id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              License number *
              <input
                value={form.license_no}
                onChange={(e) => setForm({ ...form, license_no: e.target.value })}
                placeholder="e.g., TS-MED-48291"
                required
              />
            </label>
            <label>
              Consultation fee (₹) *
              <input
                type="number"
                min="0"
                step="50"
                value={form.fee}
                onChange={(e) => setForm({ ...form, fee: e.target.value })}
                required
              />
            </label>
          </div>
          <div className="row">
            <label>
              Experience (years)
              <input
                type="number"
                min="0"
                max="70"
                value={form.experience_yrs}
                onChange={(e) => setForm({ ...form, experience_yrs: e.target.value })}
              />
            </label>
            <label>
              {editingId ? 'New password (optional)' : 'Password *'}
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editingId ? 'Leave blank to keep current' : 'Initial login password'}
                required={!editingId}
              />
            </label>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="secondary" onClick={cancelForm} disabled={busy}>
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save changes' : 'Create doctor'}
            </button>
          </div>
        </form>
      )}

      <div className="admin-toolbar">
        <input
          className="admin-search"
          type="search"
          placeholder="Search doctors by name, specialty, license no., or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {filtered && (
          <span className="muted small">
            Showing {filtered.length} of {doctors.length} doctors
          </span>
        )}
      </div>

      {!doctors && !error && <p className="muted">Loading doctors…</p>}

      {filtered && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Doctor</th>
                <th>Specialty</th>
                <th>License &amp; Exp</th>
                <th>Fee</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    No doctors found.
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.doctor_id}>
                    <td className="muted">#{d.doctor_id}</td>
                    <td>
                      <div><strong>{d.full_name}</strong></div>
                      <div className="muted small">{d.email}{d.phone ? ` · ${d.phone}` : ''}</div>
                    </td>
                    <td><span className="pill">{d.specialty_name}</span></td>
                    <td className="small">
                      <div>{d.license_no || '—'}</div>
                      <div className="muted">{d.experience_yrs ?? 0} yrs exp</div>
                    </td>
                    <td><strong>{formatRupees(d.fee)}</strong></td>
                    <td className="actions-cell">
                      <button className="secondary btn-sm" onClick={() => openEdit(d)}>
                        Edit
                      </button>
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