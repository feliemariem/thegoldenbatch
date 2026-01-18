import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInbox } from '../context/InboxContext';
import Footer from '../components/Footer';
import logo from '../images/lasalle.jpg';
import '../styles/profileNew.css';
import '../styles/directory.css';

// Mock data for batch directory - committee members and additional batchmates
const MOCK_BATCHMATES = [
  {
    id: 1,
    firstName: 'Coy',
    lastName: 'Cordova',
    currentName: 'Coy Cordova',
    email: 'coy.cordova@email.com',
    profilePhoto: null,
    headline: 'Senior Marketing Officer at Sony Philippines',
    location: { city: 'Manila', country: 'Philippines' },
    occupation: 'Senior Marketing Officer',
    company: 'Sony Philippines',
    isCommittee: true,
    goingToReunion: true,
    industry: 'Marketing'
  },
  {
    id: 2,
    firstName: 'Narciso',
    lastName: 'Javelosa',
    currentName: 'Narciso Javelosa',
    email: 'narciso.javelosa@email.com',
    profilePhoto: null,
    headline: null,
    location: { city: 'Bacolod', country: 'Philippines' },
    occupation: 'Lawyer',
    company: null,
    isCommittee: true,
    goingToReunion: true,
    industry: 'Legal'
  },
  {
    id: 3,
    firstName: 'Apple',
    lastName: 'Janklow',
    currentName: 'Apple Janklow',
    email: 'apple.janklow@email.com',
    profilePhoto: null,
    headline: null,
    location: { city: 'Bacolod', country: 'Philippines' },
    occupation: null,
    company: null,
    isCommittee: true,
    goingToReunion: false,
    industry: null
  },
  {
    id: 4,
    firstName: 'Bia',
    lastName: 'Jison',
    currentName: 'Bia Jison',
    email: 'bia.jison@email.com',
    profilePhoto: null,
    headline: null,
    location: { city: 'Bacolod', country: 'Philippines' },
    occupation: null,
    company: null,
    isCommittee: true,
    goingToReunion: true,
    industry: null
  },
  {
    id: 5,
    firstName: 'Chaya',
    lastName: 'Kramer',
    currentName: 'Chaya Kramer',
    email: 'chaya.kramer@email.com',
    profilePhoto: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=face',
    headline: 'Entrepreneur & Community Builder',
    location: { city: 'Manila', country: 'Philippines' },
    occupation: 'Entrepreneur',
    company: null,
    isCommittee: true,
    goingToReunion: true,
    industry: 'Business'
  },
  {
    id: 6,
    firstName: 'William',
    lastName: 'Kramer',
    currentName: 'William Kramer',
    email: 'william.kramer@email.com',
    profilePhoto: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
    headline: 'Real Estate Developer',
    location: { city: 'Manila', country: 'Philippines' },
    occupation: 'CEO',
    company: 'Kramer Properties',
    isCommittee: true,
    goingToReunion: true,
    industry: 'Real Estate'
  },
  {
    id: 7,
    firstName: 'Felie',
    lastName: 'Magbanua',
    currentName: 'Felie Magbanua',
    email: 'felie.magbanua@email.com',
    profilePhoto: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
    headline: 'Managing Director at FNR Core',
    location: { city: 'Los Angeles', country: 'USA' },
    occupation: 'Managing Director',
    company: 'FNR Core',
    isCommittee: true,
    goingToReunion: true,
    industry: 'Finance'
  },
  {
    id: 8,
    firstName: 'Nea',
    lastName: 'Quiachon',
    currentName: 'Nea Quiachon',
    email: 'nea.quiachon@email.com',
    profilePhoto: null,
    headline: 'Managing Partner at NQA Law Firm',
    location: { city: 'Bacolod', country: 'Philippines' },
    occupation: 'Lawyer',
    company: 'NQA Law Firm',
    isCommittee: true,
    goingToReunion: true,
    industry: 'Legal'
  },
  {
    id: 9,
    firstName: 'Mary',
    lastName: 'Uy',
    currentName: 'Mary Uy',
    email: 'mary.uy@email.com',
    profilePhoto: null,
    headline: null,
    location: { city: 'Bacolod', country: 'Philippines' },
    occupation: null,
    company: null,
    isCommittee: true,
    goingToReunion: false,
    industry: null
  },
  {
    id: 10,
    firstName: 'Nikki',
    lastName: 'Golez',
    currentName: 'Nikki Golez',
    email: 'nikki.golez@email.com',
    profilePhoto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=face',
    headline: 'Creative Director',
    location: { city: 'Manila', country: 'Philippines' },
    occupation: 'Creative Director',
    company: 'GoMedia Studios',
    isCommittee: true,
    goingToReunion: true,
    industry: 'Media & Entertainment'
  },
  // Additional batchmates with variety
  {
    id: 11,
    firstName: 'Paolo',
    lastName: 'Abello',
    currentName: 'Paolo Abello',
    email: 'paolo.abello@email.com',
    profilePhoto: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=face',
    headline: 'Investment Banker at Emirates NBD',
    location: { city: 'Dubai', country: 'UAE' },
    occupation: 'Investment Banker',
    company: 'Emirates NBD',
    isCommittee: false,
    goingToReunion: true,
    industry: 'Finance'
  },
  {
    id: 12,
    firstName: 'Maria',
    lastName: 'Benedicto',
    currentName: 'Maria Benedicto',
    email: 'maria.benedicto@email.com',
    profilePhoto: null,
    headline: 'Pediatrician at Toronto General Hospital',
    location: { city: 'Toronto', country: 'Canada' },
    occupation: 'Pediatrician',
    company: 'Toronto General Hospital',
    isCommittee: false,
    goingToReunion: true,
    industry: 'Healthcare'
  },
  {
    id: 13,
    firstName: 'Carlo',
    lastName: 'Campos',
    currentName: 'Carlo Campos',
    email: 'carlo.campos@email.com',
    profilePhoto: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
    headline: 'Software Engineer at Google',
    location: { city: 'Sydney', country: 'Australia' },
    occupation: 'Software Engineer',
    company: 'Google',
    isCommittee: false,
    goingToReunion: true,
    industry: 'Technology'
  },
  {
    id: 14,
    firstName: 'Ana',
    lastName: 'Dela Cruz',
    currentName: 'Ana Dela Cruz',
    email: 'ana.delacruz@email.com',
    profilePhoto: null,
    headline: null,
    location: { city: 'Singapore', country: 'Singapore' },
    occupation: 'HR Director',
    company: 'DBS Bank',
    isCommittee: false,
    goingToReunion: false,
    industry: 'Human Resources'
  },
  {
    id: 15,
    firstName: 'Miguel',
    lastName: 'Espino',
    currentName: 'Miguel Espino',
    email: 'miguel.espino@email.com',
    profilePhoto: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=face',
    headline: 'Architect & Urban Planner',
    location: { city: 'Melbourne', country: 'Australia' },
    occupation: 'Architect',
    company: 'Espino Design Studio',
    isCommittee: false,
    goingToReunion: true,
    industry: 'Architecture'
  },
  {
    id: 16,
    firstName: 'Lisa',
    lastName: 'Fernandez',
    currentName: 'Lisa Fernandez',
    email: 'lisa.fernandez@email.com',
    profilePhoto: null,
    headline: 'Restaurateur & Chef',
    location: { city: 'Vancouver', country: 'Canada' },
    occupation: 'Chef & Owner',
    company: 'Isla Filipino Kitchen',
    isCommittee: false,
    goingToReunion: true,
    industry: 'Food & Hospitality'
  },
  {
    id: 17,
    firstName: 'Ricardo',
    lastName: 'Garcia',
    currentName: 'Ricardo Garcia',
    email: 'ricardo.garcia@email.com',
    profilePhoto: null,
    headline: null,
    location: { city: 'Abu Dhabi', country: 'UAE' },
    occupation: 'Civil Engineer',
    company: 'AECOM',
    isCommittee: false,
    goingToReunion: false,
    industry: 'Engineering'
  },
  {
    id: 18,
    firstName: 'Christina',
    lastName: 'Hilario',
    currentName: 'Christina Hilario',
    email: 'christina.hilario@email.com',
    profilePhoto: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
    headline: 'Fashion Designer',
    location: { city: 'New York', country: 'USA' },
    occupation: 'Fashion Designer',
    company: 'CH Designs',
    isCommittee: false,
    goingToReunion: true,
    industry: 'Fashion'
  },
  {
    id: 19,
    firstName: 'Jose',
    lastName: 'Ignacio',
    currentName: 'Jose Ignacio',
    email: 'jose.ignacio@email.com',
    profilePhoto: null,
    headline: 'Orthopedic Surgeon',
    location: { city: 'Cebu', country: 'Philippines' },
    occupation: 'Orthopedic Surgeon',
    company: 'Cebu Doctors Hospital',
    isCommittee: false,
    goingToReunion: true,
    industry: 'Healthcare'
  },
  {
    id: 20,
    firstName: 'Patricia',
    lastName: 'Lopez',
    currentName: 'Patricia Lopez',
    email: 'patricia.lopez@email.com',
    profilePhoto: 'https://images.unsplash.com/photo-1489424731084-a5d8b219a5bb?w=150&h=150&fit=crop&crop=face',
    headline: 'Marketing VP at Unilever',
    location: { city: 'London', country: 'UK' },
    occupation: 'VP Marketing',
    company: 'Unilever',
    isCommittee: false,
    goingToReunion: false,
    industry: 'Marketing'
  },
  {
    id: 21,
    firstName: 'Daniel',
    lastName: 'Montenegro',
    currentName: 'Daniel Montenegro',
    email: 'daniel.montenegro@email.com',
    profilePhoto: null,
    headline: null,
    location: { city: 'Iloilo', country: 'Philippines' },
    occupation: 'Business Owner',
    company: null,
    isCommittee: false,
    goingToReunion: true,
    industry: 'Business'
  },
  {
    id: 22,
    firstName: 'Sandra',
    lastName: 'Navarro',
    currentName: 'Sandra Navarro',
    email: 'sandra.navarro@email.com',
    profilePhoto: null,
    headline: 'Nurse Manager',
    location: { city: 'Perth', country: 'Australia' },
    occupation: 'Nurse Manager',
    company: 'Royal Perth Hospital',
    isCommittee: false,
    goingToReunion: true,
    industry: 'Healthcare'
  },
  {
    id: 23,
    firstName: 'Vincent',
    lastName: 'Ortega',
    currentName: 'Vincent Ortega',
    email: 'vincent.ortega@email.com',
    profilePhoto: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop&crop=face',
    headline: 'Tech Startup Founder',
    location: { city: 'San Francisco', country: 'USA' },
    occupation: 'Founder & CEO',
    company: 'TechVenture Inc',
    isCommittee: false,
    goingToReunion: true,
    industry: 'Technology'
  },
  {
    id: 24,
    firstName: 'Michelle',
    lastName: 'Reyes',
    currentName: 'Michelle Reyes',
    email: 'michelle.reyes@email.com',
    profilePhoto: null,
    headline: null,
    location: { city: 'Hong Kong', country: 'Hong Kong' },
    occupation: 'Financial Analyst',
    company: 'HSBC',
    isCommittee: false,
    goingToReunion: false,
    industry: 'Finance'
  },
  {
    id: 25,
    firstName: 'Antonio',
    lastName: 'Santos',
    currentName: 'Antonio Santos',
    email: 'antonio.santos@email.com',
    profilePhoto: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=150&h=150&fit=crop&crop=face',
    headline: 'Professor of Economics',
    location: { city: 'Bacolod', country: 'Philippines' },
    occupation: 'Professor',
    company: 'University of St. La Salle',
    isCommittee: false,
    goingToReunion: true,
    industry: 'Education'
  }
];

// Get unique countries for filter
const getUniqueCountries = (batchmates) => {
  const countries = [...new Set(batchmates.map(b => b.location.country))].sort();
  return countries;
};

// Get unique industries for filter
const getUniqueIndustries = (batchmates) => {
  const industries = [...new Set(batchmates.filter(b => b.industry).map(b => b.industry))].sort();
  return industries;
};

export default function Directory() {
  const { user, token, logout } = useAuth();
  const { unreadCount } = useInbox();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.isAdmin;

  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [sortBy, setSortBy] = useState('lastName');
  const [eventsDropdownOpen, setEventsDropdownOpen] = useState(false);
  const eventsDropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (eventsDropdownRef.current && !eventsDropdownRef.current.contains(event.target)) {
        setEventsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Filter and sort batchmates
  const filteredBatchmates = MOCK_BATCHMATES
    .filter(person => {
      const fullName = `${person.firstName} ${person.lastName}`.toLowerCase();
      const matchesSearch = searchTerm === '' || fullName.includes(searchTerm.toLowerCase());
      const matchesCountry = countryFilter === '' || person.location.country === countryFilter;
      const matchesIndustry = industryFilter === '' || person.industry === industryFilter;
      return matchesSearch && matchesCountry && matchesIndustry;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'firstName':
          return a.firstName.localeCompare(b.firstName);
        case 'location':
          return a.location.country.localeCompare(b.location.country) ||
                 a.location.city.localeCompare(b.location.city);
        case 'lastName':
        default:
          return a.lastName.localeCompare(b.lastName);
      }
    });

  // Get initials for avatar placeholder
  const getInitials = (firstName, lastName) => {
    return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
  };

  // Handle "Say Hi" click - navigate to inbox with compose
  const handleSayHi = (person) => {
    navigate('/inbox', {
      state: {
        composeMessage: true,
        recipient: person.currentName,
        recipientEmail: person.email
      }
    });
  };

  const countries = getUniqueCountries(MOCK_BATCHMATES);
  const industries = getUniqueIndustries(MOCK_BATCHMATES);

  return (
    <div className="profile-container">
      {/* Header */}
      <header className="profile-header">
        <div className="profile-header-content">
          <div className="profile-logo-section">
            <img src={logo} alt="USLS Logo" className="profile-logo" />
            <div className="profile-title">
              <h1>THE GOLDEN BATCH</h1>
              <span className="profile-subtitle">25th Alumni Homecoming</span>
            </div>
          </div>
          <nav className="profile-nav">
            <div className={`nav-dropdown ${eventsDropdownOpen ? 'open' : ''}`} ref={eventsDropdownRef}>
              <button
                className={`nav-dropdown-trigger ${location.pathname === '/events' || location.pathname === '/media' ? 'active' : ''} ${eventsDropdownOpen ? 'open' : ''}`}
                onClick={() => setEventsDropdownOpen(!eventsDropdownOpen)}
              >
                Events <span className="dropdown-arrow">&#9660;</span>
              </button>
              <div className="nav-dropdown-menu">
                <Link to="/events" className={`nav-dropdown-item ${location.pathname === '/events' ? 'active' : ''}`} onClick={() => setEventsDropdownOpen(false)}>Upcoming</Link>
                <Link to="/media" className={`nav-dropdown-item ${location.pathname === '/media' ? 'active' : ''}`} onClick={() => setEventsDropdownOpen(false)}>Media</Link>
              </div>
            </div>
            <Link to="/committee" className="nav-link">Committee</Link>
            {isAdmin && <Link to="/directory" className="nav-link active">Directory</Link>}
            <Link to="/inbox" className="nav-link">Inbox{unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}</Link>
            <Link to="/funds" className="nav-link">Funds</Link>
            <Link to={isAdmin ? "/profile-preview" : "/profile"} className="nav-link">Profile</Link>
            {isAdmin && <Link to="/admin" className="nav-link">Admin</Link>}
            <button onClick={handleLogout} className="nav-link logout-btn">Logout</button>
          </nav>
        </div>
      </header>

      <main className="profile-main directory-main">
        {/* Page Header */}
        <section className="directory-header">
          <h2>Batch Directory</h2>
          <p>Connect with your batchmates from the Class of 2000</p>
        </section>

        {/* Filters Section */}
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
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="directory-filter-select"
            >
              <option value="">All Industries</option>
              {industries.map(industry => (
                <option key={industry} value={industry}>{industry}</option>
              ))}
            </select>
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
            Showing {filteredBatchmates.length} of {MOCK_BATCHMATES.length} batchmates
          </div>
        </section>

        {/* Directory Grid */}
        <section className="directory-grid">
          {filteredBatchmates.map(person => (
            <div key={person.id} className="directory-card">
              <div className="directory-card-photo">
                {person.profilePhoto ? (
                  <img src={person.profilePhoto} alt={person.currentName} />
                ) : (
                  <div className="directory-card-placeholder">
                    {getInitials(person.firstName, person.lastName)}
                  </div>
                )}
              </div>
              <div className="directory-card-content">
                <h3 className="directory-card-name">{person.currentName}</h3>
                {person.headline && (
                  <p className="directory-card-headline">{person.headline}</p>
                )}
                <div className="directory-card-location">
                  <span className="location-pin">&#128205;</span>
                  {person.location.city}, {person.location.country}
                </div>
                {(person.occupation || person.company) && !person.headline && (
                  <p className="directory-card-occupation">
                    {person.occupation}{person.occupation && person.company && ' at '}{person.company}
                  </p>
                )}
                <div className="directory-card-badges">
                  {person.goingToReunion && (
                    <span className="directory-badge going">Going to Reunion</span>
                  )}
                  {person.isCommittee && (
                    <span className="directory-badge committee">Committee</span>
                  )}
                </div>
                <button
                  className="directory-say-hi-btn"
                  onClick={() => handleSayHi(person)}
                >
                  Say Hi
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* Empty State */}
        {filteredBatchmates.length === 0 && (
          <div className="directory-empty">
            <p>No batchmates found matching your filters.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setCountryFilter('');
                setIndustryFilter('');
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

        <Footer />
      </main>
    </div>
  );
}
