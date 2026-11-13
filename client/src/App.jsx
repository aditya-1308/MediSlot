// MediSlot | Mohammad Mubeen Khan | client/src/App.jsx
// Router shell. Contract (everyone): you never edit this file. Instead, add
// src/pages/<area>/routes.jsx that default-exports an array like
//
//   export default [
//     { path: '/doctor/today', element: <Today />, roles: ['DOCTOR'], nav: "Today's list" },
//     { path: '/visits/:apptId/prescription', element: <Prescribe />, roles: ['DOCTOR'] },
//   ];
//
// It is picked up automatically. `roles` guards the page (omit for any
// logged-in user); `nav` adds a header link for those roles.

import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { RequireRole, useAuth } from './auth/AuthContext';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import DoctorSignup from './pages/auth/DoctorSignup';

const modules = import.meta.glob('./pages/*/routes.jsx', { eager: true });
const pageRoutes = Object.values(modules).flatMap((m) => m.default || []);

// Where each role lands after login
const HOME = { PATIENT: '/appointments', DOCTOR: '/doctor', ADMIN: '/admin' };

function Header() {
  const { user, logout } = useAuth();
  const links = user
    ? pageRoutes.filter((r) => r.nav && (!r.roles || r.roles.includes(user.role)))
    : [];
  return (
    <header className="topbar">
      <NavLink to="/" className="brand">MediSlot</NavLink>
      <nav>
        {links.map((r) => (
          <NavLink key={r.path} to={r.path}>{r.nav}</NavLink>
        ))}
      </nav>
      <div className="who">
        {user ? (
          <>
            <span>{user.name} · {user.role.toLowerCase()}</span>
            <button className="link" onClick={logout}>Log out</button>
          </>
        ) : (
          <NavLink to="/login">Log in</NavLink>
        )}
      </div>
    </header>
  );
}

function Home() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  const home = HOME[user.role];
  // Fall back to the first page this role can see if its home page is not built yet
  const exists = pageRoutes.some((r) => r.path === home);
  const first = pageRoutes.find((r) => r.nav && (!r.roles || r.roles.includes(user.role)));
  const target = exists ? home : first?.path;
  return target ? <Navigate to={target} replace /> : <p className="page">Welcome, {user.name}.</p>;
}

export default function App() {
  return (
    <>
      <Header />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/signup/doctor" element={<DoctorSignup />} />
          {pageRoutes.map((r) => (
            <Route
              key={r.path}
              path={r.path}
              element={<RequireRole roles={r.roles}>{r.element}</RequireRole>}
            />
          ))}
          <Route path="*" element={<p className="page">Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}
