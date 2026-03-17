import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../styles/profileNew.css';
import '../styles/committee.css';
import { apiGet, apiPost } from '../api';

// Section mapping by admin ID
const SECTION_MAP = {
  60: 'leadership',  // Bianca
  75: 'leadership',  // Felie
  76: 'admin',       // Mary Rose
  63: 'admin',       // Chaya
  53: 'admin',       // Coycoy
  58: 'legal',       // Nea
  64: 'legal',       // Narciso
  61: 'functions',   // Apol
  73: 'functions',   // Nikki
  65: 'functions',   // Cedric
  62: 'operations',  // William
  54: 'operations',  // JR
};

// Role bullets by admin ID
const ROLE_BULLETS = {
  60: {
    focus: 'Focus: Vision, networking, external relationships, and on-the-ground coordination',
    bullets: [
      'Leads on-the-ground logistics and represents the batch in local networks',
      'Builds relationships with alumni groups, school networks, and related communities',
      "Attends alumni and community events to build connections that strengthen the batch's network and presence",
      'Drives the vision behind batch initiatives',
    ]
  },
  75: {
    focus: 'Focus: Systems, platform development, and committee operations',
    bullets: [
      'Oversees internal operations and committee structure',
      'Facilitates committee discussions and collaborative decision-making',
      "Designed and maintains the batch's centralized digital platform",
      'Develops systems and tools that keep the batch organized, informed, and transparent',
    ]
  },
  76: {
    bullets: [
      'Custodian of batch funds',
      'Manages the official batch bank account',
      'Handles deposits and financial transactions',
      'Oversees financial reporting and transparency with the committee',
    ]
  },
  63: {
    bullets: [
      "Keeps the batch's financial records and digital ledger up to date",
      'Records contributions, deposits, and expenses',
      'Verifies and reconciles transactions with the Treasurer',
      'Ensures transparent financial reporting across the committee',
    ]
  },
  53: {
    bullets: [
      'Records and maintains minutes of committee meetings',
      'Documents discussions, decisions, and action items',
      'Keeps internal documentation organized and accessible for committee reference',
    ]
  },
  58: {
    bullets: [
      'Provides legal perspective during committee discussions',
      'Helps draft and refine formal communications and agreements',
      'Advises on consent, privacy, and responsible handling of batch information',
    ]
  },
  64: {
    bullets: [
      'Provides legal guidance when needed',
      'Serves as co-signatory to the batch bank account',
      'Reviews agreements and formal documents',
    ]
  },
  61: {
    bullets: [
      'Leads the planning and execution of batch events and gatherings',
      'Works with the committee on program development and activities',
      'Oversees event preparations as the Jubilee approaches',
    ]
  },
  73: {
    bullets: [
      'Develops official communications to the batch',
      'Drafts announcements and updates for the batch website',
      "Ensures clear and consistent messaging around the batch's work",
    ]
  },
  65: {
    bullets: [
      'Leads outreach to batchmates who have not yet registered',
      'Grows and manages the batch contact database',
      'Engages with batchmates and brings feedback to the committee',
    ]
  },
  62: {
    bullets: [
      'Helps design and refine operational processes for the committee',
      'Drives implementation of systems and workflows used by the committee',
      'Reviews documents and processes for clarity and alignment',
    ]
  },
  54: {
    bullets: [
      'Assists committee efforts and batch activities as needed',
      'Handles logistical execution of tasks',
      'Helps ensure action items from committee discussions move forward',
    ]
  },
};

// Section configuration - uppercase labels
const SECTIONS = [
  { key: 'leadership', label: 'COMMITTEE LEADERSHIP' },
  { key: 'admin', label: 'ADMINISTRATIVE & FINANCIAL' },
  { key: 'legal', label: 'LEGAL' },
  { key: 'functions', label: 'COMMITTEE FUNCTIONS' },
  { key: 'operations', label: 'OPERATIONS & IMPLEMENTATION' },
];

// IDs that get "Atty." prefix
const ATTY_IDS = [58, 64];

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
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = user?.isAdmin;

  const [members, setMembers] = useState([]);
  const [userInterests, setUserInterests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingInterest, setSavingInterest] = useState(null);
  const [toast, setToast] = useState(null);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [openRoles, setOpenRoles] = useState({});

  useEffect(() => {
    if (user) {
      fetchCommitteeData();
    }
  }, [user]);

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
        apiGet('/api/committee'),
        apiGet('/api/committee/interests')
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

  const handleExpressInterest = async (role) => {
    if (userInterests.includes(role)) return;

    setSavingInterest(role);
    try {
      const res = await apiPost('/api/committee/interests', { role });

      if (res.ok) {
        setUserInterests([...userInterests, role]);
        setToast({ message: "Thanks! The committee will reach out to you.", type: 'success', forRole: role });
        setTimeout(() => setToast(null), 4000);
      } else {
        const data = await res.json();
        setToast({ message: data.error || 'Failed to save interest', type: 'error', forRole: role });
        setTimeout(() => setToast(null), 4000);
      }
    } catch (err) {
      console.error('Failed to express interest:', err);
      setToast({ message: 'Failed to save interest', type: 'error', forRole: role });
      setTimeout(() => setToast(null), 4000);
    } finally {
      setSavingInterest(null);
    }
  };

  // Helper to get display name
  const getDisplayName = (member) => {
    return member.current_name || `${member.first_name || ''} ${member.last_name || ''}`.trim() || 'Unknown';
  };

  // Helper to parse sub-committees into array
  const parseSubCommittees = (subCommittees) => {
    if (!subCommittees) return [];
    return subCommittees.split(',').map(s => s.trim()).filter(Boolean);
  };

  // Get section for a member
  const getMemberSection = (member) => {
    return SECTION_MAP[member.id] || 'additional';
  };

  // Group members by section
  const groupedMembers = members.reduce((acc, member) => {
    const section = getMemberSection(member);
    if (!acc[section]) acc[section] = [];
    acc[section].push(member);
    return acc;
  }, {});

  // Render a member card
  const renderMemberCard = (member, isLeadership = false) => {
    const roleBullets = ROLE_BULLETS[member.id];
    const hasRoleInfo = roleBullets && roleBullets.bullets && roleBullets.bullets.length > 0;
    const isOpen = openRoles[member.id];

    // Add "Atty." prefix for legal members
    const displayName = ATTY_IDS.includes(member.id)
      ? `Atty. ${getDisplayName(member)}`
      : getDisplayName(member);

    return (
      <div
        key={member.id}
        className={`committee-card ${isLeadership ? 'leadership' : ''}`}
        data-member-email={member.email?.toLowerCase()}
      >
        <div className="committee-card-avatar">
          {member.profile_photo ? (
            <img src={member.profile_photo} alt={displayName} />
          ) : (
            <div className="committee-card-placeholder">
              {(member.first_name?.[0] || member.email?.[0] || '?').toUpperCase()}
            </div>
          )}
        </div>
        <div className="committee-card-content">
          <h4 className="committee-card-name">{displayName}</h4>
          <p className="committee-card-role">{member.role_title}</p>

          {hasRoleInfo && (
            <>
              <button
                className={`committee-see-role-btn ${isOpen ? 'expanded' : ''}`}
                onClick={() => setOpenRoles(prev => ({ ...prev, [member.id]: !prev[member.id] }))}
              >
                {isOpen ? 'Hide role' : 'See role'}
                <span className={`committee-see-role-arrow ${isOpen ? 'rotated' : ''}`}>▼</span>
              </button>

              <div className={`committee-role-collapsible ${isOpen ? 'expanded' : ''}`}>
                <div className="committee-role-content">
                  {roleBullets.focus && (
                    <p className="committee-role-focus">{roleBullets.focus}</p>
                  )}
                  <ul className="committee-role-bullets">
                    {roleBullets.bullets.map((bullet, idx) => (
                      <li key={idx}>{bullet}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
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
      <Navbar />
      <div className="card">
      <main className="profile-main committee-main">
        {/* Page Header */}
        <section className="committee-header">
          <div className="committee-header-title-row">
            <h2>The Committee</h2>
            <button
              className="mission-btn"
              onClick={() => setShowMissionModal(true)}
            >
              Our Mission
            </button>
          </div>
          <p>Meet the dedicated batchmates working to make our 25th reunion unforgettable</p>
        </section>

        {/* Global Toast Notification (for non-button related toasts) */}
        {toast && !toast.forRole && (
          <div className="committee-toast-global">
            <div className={`committee-toast ${toast.type}`}>
              {toast.message}
            </div>
          </div>
        )}

        {/* Render sections in order */}
        {SECTIONS.map(section => {
          const sectionMembers = groupedMembers[section.key] || [];
          if (sectionMembers.length === 0) return null;

          return (
            <section key={section.key} className="committee-section">
              <div className="committee-section-divider">
                <span className="committee-section-label">{section.label}</span>
              </div>
              <div className={`committee-grid committee-grid-${section.key}`}>
                {sectionMembers.map(member => renderMemberCard(member, section.key === 'leadership'))}
              </div>
            </section>
          );
        })}

        {/* Additional Members (catch-all for unmapped members) */}
        {groupedMembers.additional && groupedMembers.additional.length > 0 && (
          <section className="committee-section">
            <div className="committee-section-divider">
              <span className="committee-section-label">ADDITIONAL MEMBERS</span>
            </div>
            <div className="committee-grid committee-grid-additional">
              {groupedMembers.additional.map(member => renderMemberCard(member))}
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
          <h3 className="committee-section-title">Additional Ways to Help</h3>
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
                  {/* Toast shown inside the card when this role was clicked */}
                  {toast && toast.forRole === role.name && (
                    <div className={`committee-toast ${toast.type}`}>
                      {toast.message}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Back Link */}
        <div className="committee-back">
          <Link to={isAdmin ? "/profile-preview" : "/profile"} className="btn-link">&larr; Back to Profile</Link>
        </div>

        {/* Mission Modal */}
        {showMissionModal && (
          <div className="mission-modal-overlay" onClick={() => setShowMissionModal(false)}>
            <div className="mission-modal" onClick={e => e.stopPropagation()}>
              <button
                className="mission-modal-close"
                onClick={() => setShowMissionModal(false)}
                aria-label="Close"
              >
                &times;
              </button>
              <h2 className="mission-modal-title">Our Mission</h2>
              <p className="mission-modal-intro">
                We're bringing Batch 2003 back home. After 25 years, it's time to reconnect,
                celebrate how far we've come, and give back to the school that shaped us.
              </p>
              <h3 className="mission-modal-section-title">What We're Here For</h3>
              <div className="mission-goals">
                <div className="mission-goal">
                  <span className="mission-goal-emoji">🤝</span>
                  <div className="mission-goal-content">
                    <strong>Reconnect</strong>
                    <p>Catch up with old friends, classmates, and teachers. Revive those friendships, share stories, and remember why school felt like our second home.</p>
                  </div>
                </div>
                <div className="mission-goal">
                  <span className="mission-goal-emoji">🎉</span>
                  <div className="mission-goal-content">
                    <strong>Celebrate</strong>
                    <p>25 years is a milestone! Let's honor our achievements – individually and as a batch – and cheer each other on.</p>
                  </div>
                </div>
                <div className="mission-goal">
                  <span className="mission-goal-emoji">🌐</span>
                  <div className="mission-goal-content">
                    <strong>Network</strong>
                    <p>We've all grown in different directions. This is a chance to learn from each other, explore opportunities, and maybe even start something new together.</p>
                  </div>
                </div>
                <div className="mission-goal">
                  <span className="mission-goal-emoji">🏫</span>
                  <div className="mission-goal-content">
                    <strong>Give Back</strong>
                    <p>Time to pay it forward. Whether it's supporting school initiatives, charities, or just showing up – we're building a bridge for the next generation of Lasallians.</p>
                  </div>
                </div>
              </div>
              <p className="mission-modal-footer">See you in December 2028!</p>
            </div>
          </div>
        )}
      </main>
      </div>
      <Footer />
    </div>
  );
}
