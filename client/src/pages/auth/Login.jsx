import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';

const Tick = () => (
  <span className="tick" aria-hidden="true">
    <svg width="14" height="14" viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
  </span>
);

// Left-hand panel shared by Login and Signup
export function AuthHero() {
  return (
    <aside className="auth-hero">
      <h1>Book the right doctor, at the right time.</h1>
      <p>Search specialists across six cities, pick a free slot and pay in one step. The database guarantees your booking.</p>
      <ul>
        <li><Tick /><span><strong>No double booking.</strong> Two patients can never get the same slot.</span></li>
        <li><Tick /><span><strong>No clashes.</strong> You can't accidentally book two visits at once.</span></li>
        <li><Tick /><span><strong>Fair refunds.</strong> Full refund 24 h ahead, half up to 2 h before.</span></li>
      </ul>
    </aside>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate(location.state?.from || '/', { replace: true });
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
          <h1>Welcome back</h1>
          <p className="subtitle">Log in to manage your appointments.</p>
          <form onSubmit={submit} className="card form">
            <label>Email<input type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
            <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
            {error && <p className="error">{error}</p>}
            <button className="block" disabled={busy}>{busy ? <><span className="spinner" /> Logging in…</> : 'Log in'}</button>
          </form>
          <p className="muted">New patient? <Link to="/signup">Create an account</Link></p>
        </div>
      </section>
    </div>
  );
}
