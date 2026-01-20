import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useInbox } from '../context/InboxContext';
import Footer from '../components/Footer';
import logo from '../images/lasalle.jpg';
import '../styles/profileNew.css';
import '../styles/committee.css';

// Role descriptions for additional volunteer positions
const VOLUNTEER_ROLES = [
  {
    name: 'Fundraising',
    description: 'Help organize fundraising activities, coordinate with sponsors, and manage donation drives to support batch events and initiatives.'
  },
  {
    name: 'Logistics',
    description: 'Coordinate venue arrangements, transportation, accommodations, and all operational details for events and gatherings.'
  },
  {
    name: 'Memorabilia/Merch',
    description: 'Design and produce batch merchandise, souvenirs, and commemorative items for our 25th reunion.'
  },
  {
    name: 'Entertainment',
    description: 'Plan and coordinate entertainment programs, performances, games, and activities for batch events.'
  },
  {
    name: 'Events',
    description: 'Help plan and execute pre-reunion gatherings, mini-reunions, and coordinate event schedules.'
  },
  {
    name: 'Social Media/Multimedia',
    description: 'Manage batch social media presence, create content, handle photography/videography, and document our journey.'
  },
  {
    name: 'Outreach/Database',
    description: 'Help locate and reconnect with lost batchmates, maintain contact database, and coordinate communications.'
  },
  {
    name: 'International Relations',
    description: 'Coordinate with batchmates abroad, organize virtual participation options, and plan international meetups.'
  },
  {
    name: 'Safety & Compliance',
    description: 'Ensure event safety protocols, manage emergency procedures, and coordinate with relevant authorities.'
  }
];

export default function Committee() {
  const { user, token, logout } = useAuth();
  const { unreadCount } = useInbox();
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = user?.isAdmin;

  const [members, setMembers] = useState([]);
  const [userInterests, setUserInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingInterest, setSavingInterest] = useState(null);
  const [toast, setToast] = useState(null);
  const [eventsDropdownOpen, setEventsDropdownOpen] = useState(false);
  const eventsDropdownRef = useRef(null);

  useEffect(() => {
    if (token) {
      fetchCommitteeData();
    }
  }, [token]);

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

  // Scroll to and highlight a specific member when navigated with highlightEmail state
  useEffect(() => {
    if (location.state?.highlightEmail && members.length > 0 && !loading) {
      const highlightEmail = location.state.highlightEmail.toLowerCase();
      const highlightName = location.state.highlightName;

      // Find the member card element by email
      const memberCard = document.querySelector(`[data-member-email="${highlightEmail}"]`);

      if (memberCard) {
        // Scroll to the member card
        setTimeout(() => {
          memberCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Add highlight effect
          memberCard.style.transition = 'box-shadow 0.3s ease, transform 0.3s ease';
          memberCard.style.boxShadow = '0 0 0 3px rgba(207, 181, 59, 0.7)';
          memberCard.style.transform = 'scale(1.02)';
          setTimeout(() => {
            memberCard.style.boxShadow = '';
            memberCard.style.transform = '';
          }, 2500);
        }, 300);
      } else if (highlightName) {
        // Member not found in committee - show a toast
        setToast({ message: `${highlightName} is not on the committee page`, type: 'info' });
        setTimeout(() => setToast(null), 4000);
      }

      // Clear the state to prevent re-highlighting on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state, members, loading]);

  const fetchCommitteeData = async () => {
    try {
      // Fetch committee members and user interests in parallel
      const [membersRes, interestsRes] = await Promise.all([
        fetch('https://the-golden-batch-api.onrender.com/api/committee', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch('https://the-golden-batch-api.onrender.com/api/committee/interests', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (membersRes.ok) {
        const membersData = await membersRes.json();
        setMembers(membersData);
      }

      if (interestsRes.ok) {
        const interestsData = await interestsRes.json();
        setUserInterests(interestsData.interests || []);
      }
    } catch (err) {
      console.error('Failed to fetch committee data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleExpressInterest = async (role) => {
    if (userInterests.includes(role)) return;

    setSavingInterest(role);
    try {
      const res = await fetch('https://the-golden-batch-api.onrender.com/api/committee/interests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role })
      });

      if (res.ok) {
        setUserInterests([...userInterests, role]);
        setToast({ message: "Thanks! The committee will reach out to you.", type: 'success' });
        setTimeout(() => setToast(null), 4000);
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Failed to save interest', type: 'error' });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err) {
      console.error('Failed to express interest:', err);
      setToast({ message: 'Failed to save interest', type: 'error' });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSavingInterest(null);
    }
  };

  // Separate core leaders from regular committee members
  const coreLeaders = members.filter(m => m.is_core_leader);
  const otherMembers = members.filter(m => !m.is_core_leader);

  // Helper to get display name
  const getDisplayName = (member) => {
    return member.current_name || `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Unknown';
  };

  // Helper to parse sub-committees into array
  const parseSubCommittees = (subCommittees) => {
    if (!subCommittees) return [];
    return subCommittees.split(',').map(s => s.trim()).filter(Boolean);
  };

  if (loading) {
    return (
      <div className="container admin-container">
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Loading committee...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container admin-container">
      <div className="card">
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
            <nav className="nav-section">
              <div className={`nav-dropdown ${eventsDropdownOpen ? 'open' : ''}`} ref={eventsDropdownRef}>
                <button
                  className={`nav-dropdown-trigger ${location.pathname === '/events' || location.pathname === '/media' ? 'active' : ''} ${eventsDropdownOpen ? 'open' : ''}`}
                  onClick={() => setEventsDropdownOpen(!eventsDropdownOpen)}
                >
                  Events <span className="dropdown-arrow">▼</span>
                </button>
                <div className="nav-dropdown-menu">
                  <Link to="/events" className={`nav-dropdown-item ${location.pathname === '/events' ? 'active' : ''}`} onClick={() => setEventsDropdownOpen(false)}>Upcoming</Link>
                  <Link to="/media" className={`nav-dropdown-item ${location.pathname === '/media' ? 'active' : ''}`} onClick={() => setEventsDropdownOpen(false)}>Media</Link>
                </div>
              </div>
              <Link to="/committee" className="nav-link active">Committee</Link>
              {isAdmin && <Link to="/directory" className="nav-link">Directory</Link>}
              <Link to="/funds" className="nav-link">Funds</Link>
              <Link to="/inbox" className="nav-link">Inbox{unreadCount > 0 && <span className="unread-badge">{unreadCount}</span>}</Link>
              <Link to={isAdmin ? "/profile-preview" : "/profile"} className="nav-link">Profile</Link>
              {isAdmin && <Link to="/admin" className="nav-link">Admin</Link>}
              <button onClick={handleLogout} className="nav-link logout-btn">Logout</button>
            </nav>
        </div>
      </header>

      <main className="profile-main committee-main">
        {/* Page Header */}
        <section className="committee-header">
          <h2>The Committee</h2>
          <p>Meet the dedicated batchmates working to make our 25th reunion unforgettable</p>
        </section>

        {/* Toast Notification */}
        {toast && (
          <div className={`committee-toast ${toast.type}`}>
            {toast.message}
          </div>
        )}

        {/* Core Leaders Section */}
        {coreLeaders.length > 0 && (
          <section className="committee-section">
            <h3 className="committee-section-title">Our Organizers</h3>
            <div className="committee-grid core-leaders">
              {coreLeaders.map(member => (
                <div key={member.id} className="committee-card core" data-member-email={member.email?.toLowerCase()}>
                  <div className="committee-card-photo">
                    {member.profile_photo ? (
                      <img src={member.profile_photo} alt={getDisplayName(member)} />
                    ) : (
                      <div className="committee-card-placeholder">
                        {(member.first_name?.[0] || member.email?.[0] || '?').toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="committee-card-info">
                    <h4 className="committee-card-name">{getDisplayName(member)}</h4>
                    <p className="committee-card-role">{member.role_title}</p>
                    {parseSubCommittees(member.sub_committees).length > 0 && (
                      <ul className="committee-card-subcommittees">
                        {parseSubCommittees(member.sub_committees).map((sub, idx) => (
                          <li key={idx}>{sub}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Other Committee Members Section */}
        {otherMembers.length > 0 && (
          <section className="committee-section">
            <h3 className="committee-section-title">Committee Members</h3>
            <div className="committee-grid members">
              {otherMembers.map(member => (
                <div key={member.id} className="committee-card member" data-member-email={member.email?.toLowerCase()}>
                  <div className="committee-card-photo small">
                    {member.profile_photo ? (
                      <img src={member.profile_photo} alt={getDisplayName(member)} />
                    ) : (
                      <div className="committee-card-placeholder">
                        {(member.first_name?.[0] || member.email?.[0] || '?').toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="committee-card-info">
                    <h4 className="committee-card-name">{getDisplayName(member)}</h4>
                    <p className="committee-card-role">{member.role_title}</p>
                    {parseSubCommittees(member.sub_committees).length > 0 && (
                      <ul className="committee-card-subcommittees">
                        {parseSubCommittees(member.sub_committees).map((sub, idx) => (
                          <li key={idx}>{sub}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* No Committee Members Message */}
        {members.length === 0 && (
          <section className="committee-section">
            <div className="committee-empty">
              <p>Committee members will be displayed here once assigned.</p>
              {isAdmin && (
                <p className="committee-empty-hint">
                  Go to <Link to="/admin">Admin Dashboard</Link> &rarr; Permissions Manager to assign committee roles.
                </p>
              )}
            </div>
          </section>
        )}

        {/* Additional Roles Section */}
        <section className="committee-section volunteer-section">
          <h3 className="committee-section-title">Additional Roles with Scope</h3>
          <p className="committee-section-subtitle">
            Want to help? Express your interest and the committee will reach out to you.
          </p>
          <div className="volunteer-grid">
            {VOLUNTEER_ROLES.map(role => {
              const hasInterest = userInterests.includes(role.name);
              const isSaving = savingInterest === role.name;

              return (
                <div key={role.name} className="volunteer-card">
                  <h4 className="volunteer-card-title">{role.name}</h4>
                  <p className="volunteer-card-description">{role.description}</p>
                  <button
                    className={`volunteer-interest-btn ${hasInterest ? 'interested' : ''}`}
                    onClick={() => handleExpressInterest(role.name)}
                    disabled={hasInterest || isSaving}
                  >
                    {isSaving ? 'Saving...' : hasInterest ? "You've expressed interest" : "I'm Interested"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Back Link */}
        <div className="committee-back">
          <Link to={isAdmin ? "/profile-preview" : "/profile"} className="btn-link">&larr; Back to Profile</Link>
        </div>
      </main>
      </div>
      <Footer />
    </div>
  );
}
