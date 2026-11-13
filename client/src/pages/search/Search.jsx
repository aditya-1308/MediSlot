
// MediSlot | Potta Avinash | client/src/pages/search/Search.jsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatRupees, formatWhen } from '../../api';
import './Search.css';

export default function Search() {
  const [filters, setFilters] = useState({
    q: '',
    city: '',
    specialtyId: '',
    date: ''
  });

  const [doctors, setDoctors] = useState([]);
  const [cities, setCities] = useState([]);
  const [specialties, setSpecialties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    async function loadFilters() {
      try {
        const [cityData, specialtyData] = await Promise.all([
          api.get('/search/cities'),
          api.get('/search/specialties')
        ]);

        setCities(cityData);
        setSpecialties(specialtyData);
      } catch (err) {
        setError(err.message);
      }
    }

    loadFilters();
  }, []);

  async function searchDoctors(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSearched(true);

    try {
      const params = new URLSearchParams();

      if (filters.q.trim()) params.set('q', filters.q.trim());
      if (filters.city) params.set('city', filters.city);
      if (filters.specialtyId) {
        params.set('specialtyId', filters.specialtyId);
      }
      if (filters.date) params.set('date', filters.date);

      const result = await api.get(
        `/search/doctors?${params.toString()}`
      );

      setDoctors(result);
    } catch (err) {
      setDoctors([]);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(field, value) {
    setFilters((previous) => ({
      ...previous,
      [field]: value
    }));
  }

  function clearFilters() {
    setFilters({
      q: '',
      city: '',
      specialtyId: '',
      date: ''
    });
    setDoctors([]);
    setSearched(false);
    setError('');
  }

  return (
    <div className="page search-page">
      <div className="pagehead">
        <div>
          <h1>Find a doctor</h1>
          <p className="muted">
            Search doctors and find an available appointment.
          </p>
        </div>
        <Link to="/appointments" className="button secondary">
          My appointments
        </Link>
      </div>

      <form className="card search-form" onSubmit={searchDoctors}>
        <div className="search-grid">
          <label>
            Doctor name
            <input
              type="text"
              placeholder="Search by doctor name"
              value={filters.q}
              onChange={(e) => updateFilter('q', e.target.value)}
            />
          </label>

          <label>
            City
            <select
              value={filters.city}
              onChange={(e) => updateFilter('city', e.target.value)}
            >
              <option value="">All cities</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>

          <label>
            Specialty
            <select
              value={filters.specialtyId}
              onChange={(e) =>
                updateFilter('specialtyId', e.target.value)
              }
            >
              <option value="">All specialties</option>
              {specialties.map((specialty) => (
                <option
                  key={specialty.specialty_id}
                  value={specialty.specialty_id}
                >
                  {specialty.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Appointment date
            <input
              type="date"
              value={filters.date}
              min={new Date().toLocaleDateString('en-CA')}
              onChange={(e) => updateFilter('date', e.target.value)}
            />
          </label>
        </div>

        <div className="search-actions">
          <button type="submit" disabled={loading}>
            {loading ? 'Searching...' : 'Search doctors'}
          </button>

          <button
            type="button"
            className="secondary"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      <div className="search-results-heading">
        <h2>Available doctors</h2>
        {searched && (
          <span className="muted small">
            {doctors.length} doctor{doctors.length !== 1 ? 's' : ''} found
          </span>
        )}
      </div>

      {loading && (
        <p className="muted">Finding available doctors...</p>
      )}

      {!loading && !searched && (
        <p className="muted">
          Enter your preferences above and click Search doctors.
        </p>
      )}

      {!loading && searched && !error && doctors.length === 0 && (
        <div className="card">
          <p>No doctors with upcoming free slots match your filters.</p>
          <p className="muted small">
            Try changing your city, specialty or appointment date.
          </p>
        </div>
      )}

      {!loading && doctors.map((doctor) => (
        <article className="card doctor-card" key={doctor.doctor_id}>
          <div className="doctor-info">
            <div>
              <h2>{doctor.doctor_name}</h2>
              <p className="doctor-specialty">
                {doctor.specialty}
              </p>
            </div>

            <strong className="doctor-fee">
              {formatRupees(doctor.fee)}
            </strong>
          </div>

          <div className="doctor-details">
            <span>
              {doctor.experience_yrs} years experience
            </span>
            <span>
              {doctor.clinic_name}, {doctor.city}
            </span>
            <span>{doctor.clinic_address}</span>
          </div>

          <div className="available-slots">
            <h3>Available appointment slots</h3>

            {doctor.slots.map((slot) => (
              <div className="slot-row" key={slot.slot_id}>
                <div>
                  <strong>{formatWhen(slot.slot_start)}</strong>
                  <p className="muted small">
                    Until {new Date(slot.slot_end).toLocaleTimeString(
                      'en-IN',
                      {
                        timeZone: 'Asia/Kolkata',
                        hour: 'numeric',
                        minute: '2-digit'
                      }
                    )}
                  </p>
                </div>

                <Link
                  to={`/book/${slot.slot_id}`}
                  className="button"
                >
                  Book
                </Link>
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
