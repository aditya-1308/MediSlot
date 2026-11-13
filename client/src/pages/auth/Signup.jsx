// Patient signup. The server writes app_user + patient in one transaction,
// so a bad date of birth (chk_patient_dob) also undoes the account row.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { AuthHero } from './Login';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '', email: '', phone: '', password: '', dob: '', gender: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signup({ ...form, role: 'PATIENT', gender: form.gender || null });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <AuthHero />
      <section className="auth-panel">
        <div className="inner">
          <h1>Create your account</h1>
          <p className="subtitle">Patients sign up here. Doctors are added by the clinic admin.</p>
          <form onSubmit={submit} className="card form">
            <label>Full name<input autoComplete="name" value={form.fullName} onChange={set('fullName')} required /></label>
            <div className="row">
              <label>Email<input type="email" autoComplete="email" value={form.email} onChange={set('email')} required /></label>
              <label>Phone<input type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} placeholder="10 to 15 digits" required /></label>
            </div>
            <label>Password<input type="password" autoComplete="new-password" value={form.password} onChange={set('password')} minLength={6} placeholder="At least 6 characters" required /></label>
            <div className="row">
              <label>Date of birth<input type="date" value={form.dob} onChange={set('dob')} required /></label>
              <label>Gender
                <select value={form.gender} onChange={set('gender')}>
                  <option value="">Prefer not to say</option>
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                  <option value="O">Other</option>
                </select>
              </label>
            </div>
            {error && <p className="error">{error}</p>}
            <button className="block" disabled={busy}>{busy ? <><span className="spinner" /> Creating…</> : 'Create account'}</button>
          </form>
          <p className="muted">Already registered? <Link to="/login">Log in</Link></p>
        </div>
      </section>
    </div>
  );
}
