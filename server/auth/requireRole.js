// MediSlot | Mohammad Mubeen Khan | server/auth/requireRole.js
// Contract (everyone): import and use, never edit.
//
//   const { requireRole } = require('../auth/requireRole');
//   router.get('/x', requireRole('DOCTOR'), handler);          // one role
//   router.get('/y', requireRole('DOCTOR', 'ADMIN'), handler); // any of these
//   router.get('/z', requireRole(), handler);                  // any logged-in user
//
// After it runs, req.user = { id, role, name }. For patients and doctors,
// req.user.id is also their patient_id / doctor_id.

const jwt = require('jsonwebtoken');

function signToken(user) {
  return jwt.sign(
    { id: user.user_id, role: user.role, name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );
}

function requireRole(...roles) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Please log in' });

    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Your session has expired, please log in again' });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Only ${roles.join(' or ')} accounts can do that` });
    }
    next();
  };
}

module.exports = { requireRole, signToken };
