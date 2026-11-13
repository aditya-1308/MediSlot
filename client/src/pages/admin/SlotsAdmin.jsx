// MediSlot | client/src/pages/admin/SlotsAdmin.jsx
import { useEffect, useState } from 'react';
import { api } from '../../api';
import './admin.css';

const EMPTY_FORM = {
  doctor_id: '',
  date: '',
  start_time: '09:00',
  end_time: '12:00',
  duration_mins: '30',
};

function toLocalDateInput(isoStr) {
  const d = new Date(isoStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toLocalTimeInput(isoStr) {
  const d = new Date(isoStr);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SlotsAdmin() {
  const [clinic, setClinic] = useState(null);
  const [slots, setSlots] = useState(null);
  const [doctors, setDoctors] = useState([]);

  // Filter states
  const [doctorFilter, setDoctorFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Form states
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  function load() {
    setError('');
    Promise.all([api.get('/admin/slots'), api.get('/admin/doctors')])
      .then(([slotData, docData]) => {
        setClinic(slotData.clinic);
        setSlots(slotData.slots);
        setDoctors(docData.doctors);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  function openAdd() {
    setEditingId(null);
    const tomorrow = new Date(Date.now() + 86400000);
    setForm({
      ...EMPTY_FORM,
      doctor_id: doctorFilter || (doctors[0]?.doctor_id ? String(doctors[0].doctor_id) : ''),
      date: dateFilter || toLocalDateInput(tomorrow.toISOString()),
    });
    setShowForm(true);
    setError('');
    setNotice('');
  }

  function openEdit(slot) {
    setEditingId(slot.slot_id);
    setForm({
      doctor_id: String(slot.doctor_id),
      date: toLocalDateInput(slot.slot_start),
      start_time: toLocalTimeInput(slot.slot_start),
      end_time: toLocalTimeInput(slot.slot_end),
      duration_mins: '0',
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

  function clearFilters() {
    setDoctorFilter('');
    setDateFilter('');
    setStatusFilter('ALL');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (editingId) {
        await api.put(`/admin/slots/${editingId}`, form);
        setNotice('Updated slot timing.');
      } else {
        const res = await api.post('/admin/slots', form);
        setNotice(`Created ${res.count} consultation slot${res.count === 1 ? '' : 's'}.`);
      }
      cancelForm();
      load();
    } catch (err) {
      setError(`${err.rule ? err.rule + ': ' : ''}${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(slot) {
    if (!window.confirm(`Delete open slot #${slot.slot_id} for ${slot.doctor_name}?`)) return;
    setError('');
    setNotice('');
    try {
      await api.del(`/admin/slots/${slot.slot_id}`);
      setNotice(`Deleted slot #${slot.slot_id}.`);
      load();
    } catch (err) {
      setError(`${err.rule ? err.rule + ': ' : ''}${err.message}`);
    }
  }

  const hasActiveFilters = Boolean(doctorFilter || dateFilter || statusFilter !== 'ALL');

  const filtered = slots?.filter((s) => {
    if (doctorFilter && String(s.doctor_id) !== doctorFilter) return false;
    if (dateFilter && toLocalDateInput(s.slot_start) !== dateFilter) return false;
    if (statusFilter === 'OPEN' && s.is_booked) return false;
    if (statusFilter === 'BOOKED' && !s.is_booked) return false;
    return true;
  });

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Doctor Slots</h1>
          {clinic && (
            <p className="muted" style={{ marginTop: '-0.6rem' }}>
              {clinic.name} · {clinic.city}
            </p>
          )}
        </div>
        {!showForm && (
          <button onClick={openAdd} disabled={doctors.length === 0}>
            + Add slots
          </button>
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
          <h2>{editingId ? `Edit slot #${editingId}` : 'Add new doctor slots'}</h2>
          <div className="row">
            <label>
              Doctor *
              <select
                value={form.doctor_id}
                onChange={(e) => setForm({ ...form, doctor_id: e.target.value })}
                required
              >
                <option value="">Select doctor…</option>
                {doctors.map((d) => (
                  <option key={d.doctor_id} value={d.doctor_id}>
                    {d.full_name} ({d.specialty_name})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Date *
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </label>
          </div>
          <div className="row">
            <label>
              Start time *
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                required
              />
            </label>
            <label>
              End time *
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                required
              />
            </label>
            {!editingId && (
              <label>
                Slot duration
                <select
                  value={form.duration_mins}
                  onChange={(e) => setForm({ ...form, duration_mins: e.target.value })}
                >
                  <option value="15">15 mins (auto-split)</option>
                  <option value="20">20 mins (auto-split)</option>
                  <option value="30">30 mins (auto-split)</option>
                  <option value="45">45 mins (auto-split)</option>
                  <option value="60">60 mins (auto-split)</option>
                  <option value="0">Single slot (full range)</option>
                </select>
              </label>
            )}
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="secondary" onClick={cancelForm} disabled={busy}>
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Save slot' : 'Create slots'}
            </button>
          </div>
        </form>
      )}

      {/* Doctor (with Specialty), Single Date, and Status Filter Bar */}
      <div className="card" style={{ padding: '0.9rem 1rem', marginBottom: '1rem' }}>
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
            alignItems: 'flex-end',
          }}
        >
          <label style={{ minWidth: '230px', flex: '1 1 230px', margin: 0 }}>
            <span className="small muted">Doctor</span>
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
            >
              <option value="">All clinic doctors</option>
              {doctors.map((d) => (
                <option key={d.doctor_id} value={d.doctor_id}>
                  {d.full_name} ({d.specialty_name})
                </option>
              ))}
            </select>
          </label>

          <label style={{ minWidth: '160px', flex: '0 1 175px', margin: 0 }}>
            <span className="small muted">Date</span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </label>

          <label style={{ minWidth: '150px', flex: '0 1 165px', margin: 0 }}>
            <span className="small muted">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open only</option>
              <option value="BOOKED">Booked only</option>
            </select>
          </label>

          {hasActiveFilters && (
            <button
              type="button"
              className="secondary btn-sm"
              onClick={clearFilters}
              style={{ height: '38px' }}
            >
              Clear filters
            </button>
          )}
        </div>

        {filtered && (
          <div className="muted small" style={{ marginTop: '0.6rem' }}>
            Showing <strong>{filtered.length}</strong> of {slots.length} slots
            {dateFilter ? ` on ${dateFilter}` : ''}
          </div>
        )}
      </div>

      {!slots && !error && <p className="muted">Loading slots…</p>}

      {filtered && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Doctor</th>
                <th>Specialty</th>
                <th>Date</th>
                <th>Time window</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="muted" style={{ textAlign: 'center', padding: '1.5rem' }}>
                    No slots match the selected filters.
                  </td>
                </tr>
              ) : (
                filtered.map((s) => {
                  const start = new Date(s.slot_start);
                  const end = new Date(s.slot_end);
                  return (
                    <tr key={s.slot_id}>
                      <td className="muted">#{s.slot_id}</td>
                      <td>
                        <strong>{s.doctor_name}</strong>
                      </td>
                      <td>
                        <span className="pill">{s.specialty_name}</span>
                      </td>
                      <td>
                        {start.toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td>
                        {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                        {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td>
                        {s.is_booked ? (
                          <span className="pill">
                            Booked{s.patient_name ? ` · ${s.patient_name}` : ''}
                          </span>
                        ) : (
                          <span className="pill" style={{ background: '#e7f6ed', color: '#1b6b3a' }}>
                            Open
                          </span>
                        )}
                      </td>
                      <td className="actions-cell">
                        {!s.is_booked ? (
                          <>
                            <button className="secondary btn-sm" onClick={() => openEdit(s)}>
                              Edit
                            </button>
                            <button className="danger btn-sm" onClick={() => handleDelete(s)}>
                              Delete
                            </button>
                          </>
                        ) : (
                          <span className="muted small">Locked</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}