import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatRupees } from '../../api';

const TABS = [
  ['utilisation', 'Doctor Utilisation'],
  ['demand', 'Specialty Demand'],
  ['revenue', 'Clinic Revenue'],
  ['queries', 'Analytical Queries (Q1–Q7)'],
];

const QUERY_TITLES = {
  1: 'Q1: Peak Booking Hours',
  2: 'Q2: Doctor Performance vs Specialty Average',
  3: 'Q3: Top Doctors by Completed Visits',
  4: 'Q4: Patient Retention (2+ Visits)',
  5: 'Q5: Revenue by Payment Method',
  6: 'Q6: Cancellation Rate by Doctor',
  7: 'Q7: Next 3 Free Slots per Doctor',
};

export default function Reports() {
  const [tab, setTab] = useState('utilisation');
  const [rows, setRows] = useState([]);
  const [activeQ, setActiveQ] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    let url = '';
    if (tab === 'utilisation') url = '/admin/reports/utilisation';
    else if (tab === 'demand') url = '/admin/reports/demand';
    else if (tab === 'revenue') url = '/admin/reports/revenue';
    else if (tab === 'queries') url = `/admin/reports/queries?q=${activeQ}`;

    api.get(url)
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tab, activeQ]);

  return (
    <div className="page">
      <div className="pagehead">
        <div>
          <h1>Analytics & Reports</h1>
          <p className="muted">Database views and analytical queries for platform insights</p>
        </div>
        <Link className="button secondary" to="/admin">← Dashboard</Link>
      </div>

      <div className="tabs" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
        {TABS.map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? 'on' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'queries' && (
        <div className="row" style={{ marginBottom: '1.2rem', gap: '.4rem' }}>
          {[1, 2, 3, 4, 5, 6, 7].map((q) => (
            <button
              key={q}
              className={activeQ === q ? '' : 'secondary'}
              style={{ fontSize: '.85rem', padding: '.4rem .8rem' }}
              onClick={() => setActiveQ(q)}
            >
              Q{q}
            </button>
          ))}
          <span className="small muted" style={{ alignSelf: 'center', marginLeft: '.5rem' }}>
            {QUERY_TITLES[activeQ]}
          </span>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading report data…</p>}

      {!loading && rows.length === 0 && !error && (
        <div className="card">
          <p className="muted">No data returned for this report.</p>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--line)', background: 'var(--bg)', textAlign: 'left' }}>
                {Object.keys(rows[0]).map((col) => (
                  <th key={col} style={{ padding: '.6rem .8rem', whiteSpace: 'nowrap' }}>
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid var(--line)' }}>
                  {Object.entries(row).map(([col, val], cidx) => {
                    let formatted = val ?? '—';
                    if (col.includes('revenue') || col.includes('refund')) {
                      formatted = typeof val === 'number' || !isNaN(val) ? formatRupees(val) : val;
                    } else if (col === 'utilisation_rate' || col.includes('rate')) {
                      formatted = typeof val === 'number' ? `${(val * 100).toFixed(1)}%` : val;
                    }
                    return (
                      <td key={cidx} style={{ padding: '.6rem .8rem', whiteSpace: 'nowrap' }}>
                        {String(formatted)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
