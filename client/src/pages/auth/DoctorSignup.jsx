import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../api';
import { useAuth } from '../../auth/AuthContext';

export default function DoctorSignup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    specialtyId: '',
    licenseNo: '',
    fee: 500,
    experienceYrs: 5,
    clinicMode: 'existing', // 'existing' | 'new'
    clinicId: '',
    newClinicName: '',
    newClinicAddress: '',
    newClinicCity: '',
  });

  const [clinics, setClinics] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get('/auth/clinics'),
      api.get('/auth/specialties'),
    ])
      .then(([cls, sps]) => {
        setClinics(cls || []);
        setSpecialties(sps || []);
        if (cls && cls.length > 0) {
          setForm((f) => ({ ...f, clinicId: cls[0].clinic_id }));
        }
        if (sps && sps.length > 0) {
          setForm((f) => ({ ...f, specialtyId: sps[0].specialty_id }));
        }
      })
      .catch((err) => setError(err.message));
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);

    try {
      const payload = {
        role: 'DOCTOR',
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        specialtyId: form.specialtyId ? Number(form.specialtyId) : null,
        licenseNo: form.licenseNo.trim(),
        fee: Number(form.fee),
        experienceYrs: Number(form.experienceYrs),
      };

      if (form.clinicMode === 'new') {
        if (!form.newClinicName.trim()) {
          throw new Error('Please enter the new clinic name');
        }
        payload.newClinicName = form.newClinicName.trim();
        payload.newClinicAddress = form.newClinicAddress.trim();
        payload.newClinicCity = form.newClinicCity.trim();
      } else {
        if (!form.clinicId) {
          throw new Error('Please select an existing clinic');
        }
        payload.clinicId = Number(form.clinicId);
      }

      await signup(payload);
      navigate('/doctor', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page narrow">
      <h1>Register as a doctor</h1>
      <form onSubmit={submit} className="card form">
        <h2>Professional profile</h2>
        <label>Full name<input value={form.fullName} onChange={set('fullName')} required /></label>
        <div className="row">
          <label>Email<input type="email" value={form.email} onChange={set('email')} required /></label>
          <label>Phone<input value={form.phone} onChange={set('phone')} placeholder="10 digits" required /></label>
        </div>
        <label>Password<input type="password" value={form.password} onChange={set('password')} minLength={6} required /></label>

        <div className="row">
          <label>Specialty
            <select value={form.specialtyId} onChange={set('specialtyId')} required>
              {specialties.map((s) => (
                <option key={s.specialty_id} value={s.specialty_id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label>Medical license number
            <input value={form.licenseNo} onChange={set('licenseNo')} placeholder="e.g. MED-12345" required />
          </label>
        </div>

        <div className="row">
          <label>Consultation fee (₹)
            <input type="number" min="0" step="50" value={form.fee} onChange={set('fee')} required />
          </label>
          <label>Experience (years)
            <input type="number" min="0" max="60" value={form.experienceYrs} onChange={set('experienceYrs')} required />
          </label>
        </div>

        <h2 style={{ marginTop: '.8rem' }}>Clinic assignment</h2>
        <div className="tabs" style={{ marginBottom: '.5rem' }}>
          <button
            type="button"
            className={form.clinicMode === 'existing' ? 'on' : ''}
            onClick={() => setForm({ ...form, clinicMode: 'existing' })}
          >
            Join existing clinic
          </button>
          <button
            type="button"
            className={form.clinicMode === 'new' ? 'on' : ''}
            onClick={() => setForm({ ...form, clinicMode: 'new' })}
          >
            Register a new clinic
          </button>
        </div>

        {form.clinicMode === 'existing' ? (
          <label>
            Select clinic
            <select value={form.clinicId} onChange={set('clinicId')}>
              {clinics.map((c) => (
                <option key={c.clinic_id} value={c.clinic_id}>
                  {c.name} ({c.city})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="form">
            <label>
              New clinic name
              <input
                placeholder="e.g. City Health Clinic"
                value={form.newClinicName}
                onChange={set('newClinicName')}
                required={form.clinicMode === 'new'}
              />
            </label>
            <div className="row">
              <label style={{ flex: 2 }}>
                Address
                <input
                  placeholder="Street / Landmark"
                  value={form.newClinicAddress}
                  onChange={set('newClinicAddress')}
                />
              </label>
              <label style={{ flex: 1 }}>
                City
                <input
                  placeholder="e.g. Hyderabad"
                  value={form.newClinicCity}
                  onChange={set('newClinicCity')}
                />
              </label>
            </div>
            <p className="small muted">
              Other doctors will be able to select and register under this clinic too.
            </p>
          </div>
        )}

        {error && <p className="error">{error}</p>}
        <button disabled={busy} style={{ marginTop: '.5rem' }}>
          {busy ? 'Registering…' : 'Register doctor account'}
        </button>
      </form>

      <p className="muted">
        Already registered? <Link to="/login">Log in</Link> · Are you a patient? <Link to="/signup">Register as patient</Link>
      </p>
    </div>
  );
}
