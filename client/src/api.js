// MediSlot | Mohammad Mubeen Khan | client/src/api.js
// Contract (everyone): call the API through these helpers, never fetch directly.
//
//   import { api } from '../../api';
//   const rows = await api.get('/booking/mine?when=upcoming');
//   await api.post('/booking', { slotId, method });
//
// They attach the login token and throw an ApiError whose .message is the
// readable text from server/errors.js (and .rule is e.g. 'R1' when a business
// rule fired), so pages can show it as-is.

const TOKEN_KEY = 'medislot.token';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `Request failed (${status})`);
    this.status = status;
    this.rule = body?.rule;
    this.constraint = body?.constraint;
  }
}

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked: the session just will not survive a reload
  }
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body ?? {}),
  patch: (path, body) => request('PATCH', path, body ?? {}),
  del: (path) => request('DELETE', path),
};

// Shared display helpers
export function formatWhen(ts) {
  return new Date(ts).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatRupees(n) {
  return `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// "Dr Kavya Rao" -> "KR" (for avatars)
export function initials(name = '') {
  const parts = name.replace(/^Dr\.?\s+/i, '').split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

// Pieces of an IST date for the calendar tile: { month: 'Nov', day: '16' }
export function dateParts(ts) {
  const d = new Date(ts);
  const opt = { timeZone: 'Asia/Kolkata' };
  return {
    month: d.toLocaleString('en-IN', { ...opt, month: 'short' }),
    day: d.toLocaleString('en-IN', { ...opt, day: 'numeric' }),
    time: d.toLocaleString('en-IN', { ...opt, hour: 'numeric', minute: '2-digit' }),
    weekday: d.toLocaleString('en-IN', { ...opt, weekday: 'long' }),
  };
}
