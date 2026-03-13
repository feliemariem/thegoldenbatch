import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaFacebook, FaLinkedin, FaInstagram } from 'react-icons/fa';
import { apiGet } from '../api';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/profileNew.css';
import '../styles/directory.css';

const DirectoryCard = ({ entry }) => {
  const registered = entry.status === 'Registered';
  const memoriam = entry.in_memoriam;
  const friend = entry.section === 'Non-Graduate';
  const displayName = entry.current_name || `${entry.first_name} ${entry.last_name}`;
  const initials = `${entry.first_name?.charAt(0) || ''}${entry.last_name?.charAt(0) || ''}`;
  const hasSocials = entry.facebook_url || entry.linkedin_url || entry.instagram_url;

  return (
    <div className={`directory-card ${!registered && !memoriam ? 'not-registered' : ''} ${memoriam ? 'memoriam' : ''}`}>
      <div className={`dir-avatar ${memoriam ? 'memoriam-av' : ''}`}>
        {registered && entry.profile_photo
          ? <img src={entry.profile_photo} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          : <span>{initials}</span>
        }
      </div>
      <p className="dir-card-name">{displayName}</p>
      {!memoriam && (
        <p className="dir-card-section">
          {friend ? 'Friend of Batch' : entry.section || ''}
        </p>
      )}
      {registered && (entry.city || entry.country) && (
        <p className="dir-card-location">
          {[entry.city, entry.country].filter(Boolean).join(', ')}
        </p>
      )}
      <span className={`dir-badge ${memoriam ? 'dir-badge-mem' : registered ? 'dir-badge-reg' : 'dir-badge-not'}`}>
        {memoriam ? 'In memoriam' : registered ? 'Registered' : 'Not registered'}
      </span>
      {registered && hasSocials && (
        <div className="dir-card-socials">
          {entry.facebook_url && <a href={`https://facebook.com/${entry.facebook_url}`} target="_blank" rel="noopener noreferrer" className="dir-social-link"><FaFacebook size={12} /></a>}
          {entry.linkedin_url && <a href={`https://linkedin.com/in/${entry.linkedin_url}`} target="_blank" rel="noopener noreferrer" className="dir-social-link"><FaLinkedin size={12} /></a>}
          {entry.instagram_url && <a href={`https://instagram.com/${entry.instagram_url}`} target="_blank" rel="noopener noreferrer" className="dir-social-link"><FaInstagram size={12} /></a>}
        </div>
      )}
    </div>
  );
};

export default function Directory() {
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.isAdmin;

  const [entries, setEntries] = useState([]);
  const [shuffled, setShuffled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('');
  const [sortBy, setSortBy] = useState('lastName');

  // Read section query param on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const section = params.get('section');
    if (section) {
      setGroupFilter(section);
    }
  }, [location.search]);

  // Fetch on mount
  useEffect(() => {
    apiGet('/api/master-list/directory')
      .then(res => res.json())
      .then(data => {
        setEntries(data.entries || []);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  // Shuffle once when entries load
  useEffect(() => {
    if (!entries.length) return;
    const arr = [...entries];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setShuffled(arr);
  }, [entries]);

  // Derived values
  const countries = [...new Set(entries.filter(e => e.country).map(e => e.country))].sort();

  // Filtering + sorting
  const filtered = shuffled
    .filter(e => {
      if (groupFilter === 'graduates') return e.section !== 'Non-Graduate' && !e.in_memoriam;
      if (groupFilter === 'friends') return e.section === 'Non-Graduate' && !e.in_memoriam;
      if (groupFilter === 'memoriam') return e.in_memoriam;
      if (['11A', '11B', '11C', '11D', '11E'].includes(groupFilter)) return e.section === groupFilter && !e.in_memoriam;
      return true; // 'all' shows everyone including in memoriam
    })
    .filter(e => {
      if (!searchTerm) return true;
      const name = `${e.first_name} ${e.last_name} ${e.current_name || ''}`.toLowerCase();
      return name.includes(searchTerm.toLowerCase());
    })
    .filter(e => !countryFilter || e.country === countryFilter)
    .sort((a, b) => {
      if (sortBy === 'firstName') return (a.first_name || '').localeCompare(b.first_name || '');
      if (sortBy === 'location') return (a.country || '').localeCompare(b.country || '');
      return (a.last_name || '').localeCompare(b.last_name || '');
    });

  return (
    <div className="container admin-container">
      <Navbar />
      <div className="card">
        <main className="profile-main directory-main">
          <div className="directory-header">
            <h1 className="directory-title">Batch Directory</h1>
            <p className="directory-subtitle">USLS-IS 2003 · The Golden Batch</p>
          </div>

          <section className="directory-filters">
            <div className="dir-filter-row">
              <input
                className="dir-search"
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="dir-select">
                <option value="all">All</option>
                <option value="graduates">Graduates</option>
                <option value="11A">11A</option>
                <option value="11B">11B</option>
                <option value="11C">11C</option>
                <option value="11D">11D</option>
                <option value="11E">11E</option>
                <option value="friends">Friends of Batch</option>
                <option value="memoriam">In memoriam</option>
              </select>
              <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} className="dir-select">
                <option value="">All countries</option>
                {countries.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="dir-select">
                <option value="lastName">Last name A–Z</option>
                <option value="firstName">First name A–Z</option>
                <option value="location">Location</option>
              </select>
            </div>

            {(searchTerm || groupFilter !== 'all' || countryFilter || sortBy !== 'lastName') && (
              <button className="dir-clear-filters" onClick={() => {
                setSearchTerm('');
                setGroupFilter('all');
                setCountryFilter('');
                setSortBy('lastName');
              }}>
                Clear filters
              </button>
            )}

            <div className="directory-results-count">
              Showing {filtered.length} of {entries.length} batchmates
            </div>
          </section>

          {loading ? (
            <p className="dir-loading">Loading...</p>
          ) : (
            <div className="directory-grid">
              {filtered.map(entry => <DirectoryCard key={entry.id} entry={entry} />)}
            </div>
          )}

          {/* Empty State */}
          {!loading && filtered.length === 0 && (
            <div className="directory-empty">
              <p>No batchmates found matching your filters.</p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setGroupFilter('all');
                  setCountryFilter('');
                }}
                className="directory-clear-filters"
              >
                Clear Filters
              </button>
            </div>
          )}

          {/* Back Link */}
          <div className="directory-back">
            <Link to={isAdmin ? "/profile-preview" : "/profile"} className="btn-link">&larr; Back to Profile</Link>
          </div>
        </main>
      </div>
      <Footer />
    </div>
  );
}
