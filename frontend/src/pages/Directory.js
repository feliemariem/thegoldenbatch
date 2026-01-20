import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
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
    industry: 'Marketing',
    socials: { facebook: 'https://facebook.com/coy.cordova' }
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
    industry: 'Legal',
    socials: { linkedin: 'https://linkedin.com/in/narciso-javelosa' }
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
    industry: null,
    socials: { instagram: 'https://instagram.com/apple.janklow' }
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
    industry: null,
    socials: { facebook: 'https://facebook.com/bia.jison' }
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
    industry: 'Business',
    socials: {}
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
    industry: 'Real Estate',
    socials: { linkedin: 'https://linkedin.com/in/william-kramer' }
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
    industry: 'Finance',
    socials: { facebook: 'https://facebook.com/felie.magbanua', linkedin: 'https://linkedin.com/in/felie-magbanua', instagram: 'https://instagram.com/felie.magbanua' }
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
    industry: 'Legal',
    socials: { facebook: 'https://facebook.com/nea.quiachon' }
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
    industry: null,
    socials: {}
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
    industry: 'Media & Entertainment',
    socials: { instagram: 'https://instagram.com/nikki.golez' }
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
    industry: 'Finance',
    socials: { linkedin: 'https://linkedin.com/in/paolo-abello', facebook: 'https://facebook.com/paolo.abello' }
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
    industry: 'Healthcare',
    socials: { linkedin: 'https://linkedin.com/in/maria-benedicto' }
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
    industry: 'Technology',
    socials: { linkedin: 'https://linkedin.com/in/carlo-campos', instagram: 'https://instagram.com/carlo.campos' }
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
    industry: 'Human Resources',
    socials: { linkedin: 'https://linkedin.com/in/ana-delacruz' }
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
    industry: 'Architecture',
    socials: { instagram: 'https://instagram.com/miguel.espino', linkedin: 'https://linkedin.com/in/miguel-espino' }
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
    industry: 'Food & Hospitality',
    socials: { instagram: 'https://instagram.com/isla.kitchen', facebook: 'https://facebook.com/islakitchen' }
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
    industry: 'Engineering',
    socials: {}
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
    industry: 'Fashion',
    socials: { instagram: 'https://instagram.com/ch.designs', linkedin: 'https://linkedin.com/in/christina-hilario' }
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
    industry: 'Healthcare',
    socials: { facebook: 'https://facebook.com/jose.ignacio.md' }
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
    industry: 'Marketing',
    socials: { linkedin: 'https://linkedin.com/in/patricia-lopez' }
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
    industry: 'Business',
    socials: { facebook: 'https://facebook.com/daniel.montenegro' }
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
    industry: 'Healthcare',
    socials: {}
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
    industry: 'Technology',
    socials: { linkedin: 'https://linkedin.com/in/vincent-ortega', instagram: 'https://instagram.com/vincent.ortega', facebook: 'https://facebook.com/vincent.ortega' }
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
    industry: 'Finance',
    socials: { linkedin: 'https://linkedin.com/in/michelle-reyes' }
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
    industry: 'Education',
    socials: { facebook: 'https://facebook.com/antonio.santos' }
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.isAdmin;

  const [searchTerm, setSearchTerm] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [industryFilter, setIndustryFilter] = useState('');
  const [sortBy, setSortBy] = useState('lastName');

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

  const countries = getUniqueCountries(MOCK_BATCHMATES);
  const industries = getUniqueIndustries(MOCK_BATCHMATES);

  return (
    <div className="container admin-container">
      <Navbar />
      <div className="card">
      <main className="profile-main directory-main">
        {/* Page Header */}
        <section className="directory-header">
          <h2>Batch Directory</h2>
          <p>Connect with your batchmates from Batch 2003</p>
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
                {/* Social Media Icons */}
                {person.socials && Object.keys(person.socials).length > 0 && (
                  <div className="directory-card-socials">
                    {person.socials.facebook && (
                      <a href={person.socials.facebook} target="_blank" rel="noopener noreferrer" className="social-icon facebook" title="Facebook">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </a>
                    )}
                    {person.socials.linkedin && (
                      <a href={person.socials.linkedin} target="_blank" rel="noopener noreferrer" className="social-icon linkedin" title="LinkedIn">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                      </a>
                    )}
                    {person.socials.instagram && (
                      <a href={person.socials.instagram} target="_blank" rel="noopener noreferrer" className="social-icon instagram" title="Instagram">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                          <path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.76-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                )}
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
      </main>
      </div>
      <Footer />
    </div>
  );
}
