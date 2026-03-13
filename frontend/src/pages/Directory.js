import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaFacebook, FaLinkedin, FaInstagram } from 'react-icons/fa';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/profileNew.css';
import '../styles/directory.css';

// Mock data for batch directory
const MOCK_BATCHMATES = [
  {
    id: 1,
    firstName: 'Coy',
    lastName: 'Cordova',
    currentName: 'Coy Cordova',
    isRegistered: true,
    profilePhoto: null,
    location: { city: 'Manila', country: 'Philippines' },
    isGraduate: true,
    isMemoriam: false,
    section: '11A',
    socials: { facebook: 'coy.cordova' }
  },
  {
    id: 2,
    firstName: 'Narciso',
    lastName: 'Javelosa',
    currentName: 'Narciso Javelosa',
    isRegistered: true,
    profilePhoto: null,
    location: { city: 'Bacolod', country: 'Philippines' },
    isGraduate: true,
    isMemoriam: false,
    section: '11A',
    socials: { linkedin: 'narciso-javelosa' }
  },
  {
    id: 3,
    firstName: 'Apple',
    lastName: 'Janklow',
    currentName: 'Apple Janklow',
    isRegistered: true,
    profilePhoto: null,
    location: { city: 'Bacolod', country: 'Philippines' },
    isGraduate: true,
    isMemoriam: false,
    section: '11B',
    socials: { instagram: 'apple.janklow' }
  },
  {
    id: 4,
    firstName: 'Bia',
    lastName: 'Jison',
    currentName: 'Bia Jison',
    isRegistered: true,
    profilePhoto: null,
    location: { city: 'Bacolod', country: 'Philippines' },
    isGraduate: true,
    isMemoriam: false,
    section: '11B',
    socials: { facebook: 'bia.jison' }
  },
  {
    id: 5,
    firstName: 'Chaya',
    lastName: 'Kramer',
    currentName: 'Chaya Kramer',
    isRegistered: true,
    profilePhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
    location: { city: 'Manila', country: 'Philippines' },
    isGraduate: true,
    isMemoriam: false,
    section: '11C',
    socials: {}
  },
  {
    id: 6,
    firstName: 'William',
    lastName: 'Kramer',
    currentName: 'William Kramer',
    isRegistered: true,
    profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    location: { city: 'Manila', country: 'Philippines' },
    isGraduate: true,
    isMemoriam: false,
    section: '11C',
    socials: { linkedin: 'william-kramer' }
  },
  {
    id: 7,
    firstName: 'Felie',
    lastName: 'Magbanua',
    currentName: 'Felie Magbanua',
    isRegistered: true,
    profilePhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    location: { city: 'Los Angeles', country: 'USA' },
    isGraduate: true,
    isMemoriam: false,
    section: '11A',
    socials: { facebook: 'felie.magbanua', linkedin: 'felie-magbanua', instagram: 'felie.magbanua' }
  },
  {
    id: 8,
    firstName: 'Nea',
    lastName: 'Quiachon',
    currentName: 'Nea Quiachon',
    isRegistered: true,
    profilePhoto: null,
    location: { city: 'Bacolod', country: 'Philippines' },
    isGraduate: true,
    isMemoriam: false,
    section: '11D',
    socials: { facebook: 'nea.quiachon' }
  },
  {
    id: 9,
    firstName: 'Mary',
    lastName: 'Uy',
    currentName: 'Mary Uy',
    isRegistered: true,
    profilePhoto: null,
    location: { city: 'Bacolod', country: 'Philippines' },
    isGraduate: true,
    isMemoriam: false,
    section: '11D',
    socials: {}
  },
  {
    id: 10,
    firstName: 'Nikki',
    lastName: 'Golez',
    currentName: 'Nikki Golez',
    isRegistered: true,
    profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
    location: { city: 'Manila', country: 'Philippines' },
    isGraduate: true,
    isMemoriam: false,
    section: '11B',
    socials: { instagram: 'nikki.golez' }
  },
  {
    id: 11,
    firstName: 'Paolo',
    lastName: 'Abello',
    currentName: 'Paolo Abello',
    isRegistered: true,
    profilePhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    location: { city: 'Dubai', country: 'UAE' },
    isGraduate: true,
    isMemoriam: false,
    section: '11A',
    socials: { linkedin: 'paolo-abello', facebook: 'paolo.abello' }
  },
  {
    id: 12,
    firstName: 'Maria',
    lastName: 'Benedicto',
    currentName: 'Maria Benedicto',
    isRegistered: true,
    profilePhoto: null,
    location: { city: 'Toronto', country: 'Canada' },
    isGraduate: true,
    isMemoriam: false,
    section: '11C',
    socials: { linkedin: 'maria-benedicto' }
  },
  {
    id: 13,
    firstName: 'Carlo',
    lastName: 'Campos',
    currentName: 'Carlo Campos',
    isRegistered: true,
    profilePhoto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    location: { city: 'Sydney', country: 'Australia' },
    isGraduate: true,
    isMemoriam: false,
    section: '11B',
    socials: { linkedin: 'carlo-campos', instagram: 'carlo.campos' }
  },
  {
    id: 14,
    firstName: 'Ana',
    lastName: 'Dela Cruz',
    currentName: 'Ana Dela Cruz',
    isRegistered: false,
    profilePhoto: null,
    location: { city: 'Singapore', country: 'Singapore' },
    isGraduate: true,
    isMemoriam: false,
    section: '11D',
    socials: {}
  },
  {
    id: 15,
    firstName: 'Miguel',
    lastName: 'Espino',
    currentName: 'Miguel Espino',
    isRegistered: true,
    profilePhoto: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face',
    location: { city: 'Melbourne', country: 'Australia' },
    isGraduate: true,
    isMemoriam: false,
    section: '11A',
    socials: { instagram: 'miguel.espino', linkedin: 'miguel-espino' }
  },
  {
    id: 16,
    firstName: 'Lisa',
    lastName: 'Fernandez',
    currentName: 'Lisa Fernandez',
    isRegistered: true,
    profilePhoto: null,
    location: { city: 'Vancouver', country: 'Canada' },
    isGraduate: true,
    isMemoriam: false,
    section: '11C',
    socials: { instagram: 'lisa.fernandez', facebook: 'lisafernandez' }
  },
  {
    id: 17,
    firstName: 'Ricardo',
    lastName: 'Garcia',
    currentName: 'Ricardo Garcia',
    isRegistered: false,
    profilePhoto: null,
    location: { city: 'Abu Dhabi', country: 'UAE' },
    isGraduate: true,
    isMemoriam: false,
    section: '11B',
    socials: {}
  },
  {
    id: 18,
    firstName: 'Christina',
    lastName: 'Hilario',
    currentName: 'Christina Hilario',
    isRegistered: true,
    profilePhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    location: { city: 'New York', country: 'USA' },
    isGraduate: true,
    isMemoriam: false,
    section: '11D',
    socials: { instagram: 'ch.designs', linkedin: 'christina-hilario' }
  },
  {
    id: 19,
    firstName: 'Jose',
    lastName: 'Ignacio',
    currentName: 'Jose Ignacio',
    isRegistered: true,
    profilePhoto: null,
    location: { city: 'Cebu', country: 'Philippines' },
    isGraduate: true,
    isMemoriam: false,
    section: '11A',
    socials: { facebook: 'jose.ignacio.md' }
  },
  {
    id: 20,
    firstName: 'Patricia',
    lastName: 'Lopez',
    currentName: 'Patricia Lopez',
    isRegistered: false,
    profilePhoto: null,
    location: { city: 'London', country: 'UK' },
    isGraduate: true,
    isMemoriam: false,
    section: '11C',
    socials: {}
  },
  {
    id: 21,
    firstName: 'Daniel',
    lastName: 'Montenegro',
    currentName: 'Daniel Montenegro',
    isRegistered: true,
    profilePhoto: null,
    location: { city: 'Iloilo', country: 'Philippines' },
    isGraduate: true,
    isMemoriam: false,
    section: '11B',
    socials: { facebook: 'daniel.montenegro' }
  },
  {
    id: 22,
    firstName: 'Sandra',
    lastName: 'Navarro',
    currentName: 'Sandra Navarro',
    isRegistered: true,
    profilePhoto: null,
    location: { city: 'Perth', country: 'Australia' },
    isGraduate: true,
    isMemoriam: false,
    section: '11D',
    socials: {}
  },
  {
    id: 23,
    firstName: 'Vincent',
    lastName: 'Ortega',
    currentName: 'Vincent Ortega',
    isRegistered: true,
    profilePhoto: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face',
    location: { city: 'San Francisco', country: 'USA' },
    isGraduate: true,
    isMemoriam: false,
    section: '11A',
    socials: { linkedin: 'vincent-ortega', instagram: 'vincent.ortega', facebook: 'vincent.ortega' }
  },
  {
    id: 24,
    firstName: 'Michelle',
    lastName: 'Reyes',
    currentName: 'Michelle Reyes',
    isRegistered: false,
    profilePhoto: null,
    location: { city: 'Hong Kong', country: 'Hong Kong' },
    isGraduate: true,
    isMemoriam: false,
    section: '11C',
    socials: {}
  },
  {
    id: 25,
    firstName: 'Antonio',
    lastName: 'Santos',
    currentName: 'Antonio Santos',
    isRegistered: true,
    profilePhoto: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=150&h=150&fit=crop&crop=face',
    location: { city: 'Bacolod', country: 'Philippines' },
    isGraduate: true,
    isMemoriam: false,
    section: '11D',
    socials: { facebook: 'antonio.santos' }
  },
  // Friends of Batch 2003
  {
    id: 26,
    firstName: 'Mark',
    lastName: 'Thompson',
    currentName: 'Mark Thompson',
    isRegistered: true,
    profilePhoto: null,
    location: { city: 'Bacolod', country: 'Philippines' },
    isGraduate: false,
    isMemoriam: false,
    section: null,
    socials: { facebook: 'mark.thompson' }
  },
  {
    id: 27,
    firstName: 'Sarah',
    lastName: 'Williams',
    currentName: 'Sarah Williams',
    isRegistered: true,
    profilePhoto: null,
    location: { city: 'Manila', country: 'Philippines' },
    isGraduate: false,
    isMemoriam: false,
    section: null,
    socials: {}
  },
  {
    id: 28,
    firstName: 'James',
    lastName: 'Miller',
    currentName: 'James Miller',
    isRegistered: false,
    profilePhoto: null,
    location: { city: 'Cebu', country: 'Philippines' },
    isGraduate: false,
    isMemoriam: false,
    section: null,
    socials: {}
  },
  // In Memoriam
  {
    id: 29,
    firstName: 'Roberto',
    lastName: 'Villanueva',
    currentName: null,
    isRegistered: false,
    profilePhoto: null,
    location: { city: 'Bacolod', country: 'Philippines' },
    isGraduate: true,
    isMemoriam: true,
    section: '11A',
    socials: {}
  },
  {
    id: 30,
    firstName: 'Elena',
    lastName: 'Mendoza',
    currentName: null,
    isRegistered: false,
    profilePhoto: null,
    location: { city: 'Manila', country: 'Philippines' },
    isGraduate: true,
    isMemoriam: true,
    section: '11B',
    socials: {}
  },
  {
    id: 31,
    firstName: 'Marco',
    lastName: 'Tan',
    currentName: null,
    isRegistered: false,
    profilePhoto: null,
    location: { city: 'Bacolod', country: 'Philippines' },
    isGraduate: true,
    isMemoriam: true,
    section: '11C',
    socials: {}
  }
];

// Get unique countries from data
const getUniqueCountries = (batchmates) => {
  return [...new Set(batchmates.map(b => b.location.country))].sort();
};

// Get unique sections from data
const getUniqueSections = (batchmates) => {
  return [...new Set(batchmates.filter(b => b.section).map(b => b.section))].sort();
};

export default function Directory() {
  const { user } = useAuth();
  const isAdmin = user?.isAdmin;

  const [shuffled, setShuffled] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [countryFilter, setCountryFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [sortBy, setSortBy] = useState('lastName');

  // Fisher-Yates shuffle on mount
  useEffect(() => {
    const arr = [...MOCK_BATCHMATES];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    setShuffled(arr);
  }, []);

  // Filter and sort
  const filtered = shuffled
    .filter(p => {
      if (groupFilter === 'graduates') return p.isGraduate && !p.isMemoriam;
      if (groupFilter === 'friends') return !p.isGraduate && !p.isMemoriam;
      if (groupFilter === 'memoriam') return p.isMemoriam;
      return true;
    })
    .filter(p => !searchTerm || `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter(p => !countryFilter || p.location.country === countryFilter)
    .filter(p => !sectionFilter || p.section === sectionFilter)
    .sort((a, b) => {
      if (sortBy === 'firstName') return a.firstName.localeCompare(b.firstName);
      if (sortBy === 'location') return (a.location.country || '').localeCompare(b.location.country || '');
      return a.lastName.localeCompare(b.lastName);
    });

  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  const countries = getUniqueCountries(MOCK_BATCHMATES);
  const sections = getUniqueSections(MOCK_BATCHMATES);

  // Show section filter only for graduates
  const showSectionFilter = groupFilter === 'all' || groupFilter === 'graduates';

  return (
    <div className="container admin-container">
      <Navbar />
      <div className="card">
        <main className="profile-main directory-main">
          {/* Hero Banner */}
          <div className="directory-hero">
            <h1>Batch Directory</h1>
            <p>USLS-IS 2003 · The Golden Batch</p>
          </div>

          {/* Search */}
          <section className="directory-filters">
            <div className="directory-search">
              <input
                type="text"
                placeholder="Search by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="directory-search-input"
              />
            </div>

            {/* Group Filter Buttons */}
            <div className="dir-filter-btns">
              <button
                className={`dir-filter-btn ${groupFilter === 'all' ? 'active' : ''}`}
                onClick={() => { setGroupFilter('all'); setSectionFilter(''); }}
              >
                All
              </button>
              <button
                className={`dir-filter-btn ${groupFilter === 'graduates' ? 'active' : ''}`}
                onClick={() => { setGroupFilter('graduates'); }}
              >
                Graduates
              </button>
              <button
                className={`dir-filter-btn ${groupFilter === 'friends' ? 'active' : ''}`}
                onClick={() => { setGroupFilter('friends'); setSectionFilter(''); }}
              >
                Friends of Batch 2003
              </button>
              <button
                className={`dir-filter-btn memoriam ${groupFilter === 'memoriam' ? 'active' : ''}`}
                onClick={() => { setGroupFilter('memoriam'); setSectionFilter(''); }}
              >
                In memoriam
              </button>
            </div>

            {/* Dropdowns */}
            <div className="directory-filter-row">
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="directory-filter-select"
              >
                <option value="">All Countries</option>
                {countries.map(country => (
                  <option key={country} value={country}>{country}</option>
                ))}
              </select>
              {showSectionFilter && (
                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="directory-filter-select"
                >
                  <option value="">All Sections</option>
                  {sections.map(section => (
                    <option key={section} value={section}>{section}</option>
                  ))}
                </select>
              )}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="directory-filter-select"
              >
                <option value="lastName">Sort: Last Name A-Z</option>
                <option value="firstName">Sort: First Name A-Z</option>
                <option value="location">Sort: Location</option>
              </select>
            </div>

            <div className="directory-results-count">
              Showing {filtered.length} of {MOCK_BATCHMATES.length} batchmates
            </div>
          </section>

          {/* Directory Grid */}
          <section className="directory-grid">
            {filtered.map(person => {
              const displayName = person.currentName || `${person.firstName} ${person.lastName}`;
              const hasSocials = person.socials && (person.socials.facebook || person.socials.linkedin || person.socials.instagram);

              let cardClass = 'directory-card';
              if (!person.isRegistered && !person.isMemoriam) cardClass += ' not-registered';
              if (person.isMemoriam) cardClass += ' memoriam';

              return (
                <div key={person.id} className={cardClass}>
                  {/* Avatar */}
                  <div className={`dir-avatar ${person.isMemoriam ? 'memoriam-av' : ''}`}>
                    {person.profilePhoto && !person.isMemoriam ? (
                      <img src={person.profilePhoto} alt={displayName} />
                    ) : (
                      <span className="dir-avatar-initials">
                        {getInitials(person.firstName, person.lastName)}
                      </span>
                    )}
                  </div>

                  {/* Name */}
                  <div className="dir-card-name">{displayName}</div>

                  {/* Section */}
                  {!person.isMemoriam && (
                    <div className="dir-card-section">
                      {person.isGraduate ? person.section : 'Friend of Batch'}
                    </div>
                  )}

                  {/* Location */}
                  <div className="dir-card-location">
                    {person.isRegistered || person.isMemoriam
                      ? `${person.location.city}, ${person.location.country}`
                      : '—'}
                  </div>

                  {/* Badge */}
                  {person.isMemoriam ? (
                    <span className="dir-badge dir-badge-mem">In memoriam</span>
                  ) : person.isRegistered ? (
                    <span className="dir-badge dir-badge-reg">Registered</span>
                  ) : (
                    <span className="dir-badge dir-badge-not">Not registered</span>
                  )}

                  {/* Social Icons */}
                  {hasSocials && !person.isMemoriam && (
                    <div className="dir-card-socials">
                      {person.socials.facebook && (
                        <a
                          href={`https://facebook.com/${person.socials.facebook}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="dir-social-link"
                          title="Facebook"
                        >
                          <FaFacebook />
                        </a>
                      )}
                      {person.socials.linkedin && (
                        <a
                          href={`https://linkedin.com/in/${person.socials.linkedin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="dir-social-link"
                          title="LinkedIn"
                        >
                          <FaLinkedin />
                        </a>
                      )}
                      {person.socials.instagram && (
                        <a
                          href={`https://instagram.com/${person.socials.instagram}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="dir-social-link"
                          title="Instagram"
                        >
                          <FaInstagram />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          {/* Empty State */}
          {filtered.length === 0 && (
            <div className="directory-empty">
              <p>No batchmates found matching your filters.</p>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setGroupFilter('all');
                  setCountryFilter('');
                  setSectionFilter('');
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
