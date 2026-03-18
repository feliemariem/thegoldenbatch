import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MyTasks from '../components/MyTasks';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SystemAdminProfile from '../components/SystemAdminProfile';
import BatchRepModal from '../components/BatchRepModal';
import MerchModal from '../components/MerchModal';
import RSVPCard from '../components/RSVPCard';
import AlumniCardNudge from '../components/AlumniCardNudge';
import BuilderCard from '../components/BuilderCard';
import InfoCard from '../components/InfoCard';
import UserGuide from '../components/UserGuide';
import '../styles/profileNew.css';
import '../styles/batchrep.css';
import { apiGet, apiPut } from '../api';
import { checkPhaseAccess, isDeadlinePassed } from '../config/batchRepConfig';
import { formatEventDate } from '../utils/profileUtils';

export default function ProfileNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [profile, setProfile] = useState(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [myEvents, setMyEvents] = useState([]);
  const [showGuide, setShowGuide] = useState(false);
  const [showMerchModal, setShowMerchModal] = useState(false);
  const [merchForm, setMerchForm] = useState({ shirt_size: '', jacket_size: '' });
  const [merchSaving, setMerchSaving] = useState(false);
  const [alumniCardSaving, setAlumniCardSaving] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [showBatchRepModal, setShowBatchRepModal] = useState(false);
  const [batchRepChecked, setBatchRepChecked] = useState(false);
  const [batchRepHasSubmitted, setBatchRepHasSubmitted] = useState(false);

  // Reset batchRepChecked on every mount so status is re-fetched fresh
  useEffect(() => {
    setBatchRepChecked(false);
  }, []);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchMyEvents();
      checkSystemAdmin();
    } else {
      // Reset batch rep state on logout
      setBatchRepChecked(false);
      setBatchRepHasSubmitted(false);
      setShowBatchRepModal(false);
    }
  }, [user]);

  // Check batch-rep status after profile loads
  useEffect(() => {
    const checkBatchRepStatus = async () => {
      if (!profile || batchRepChecked) return;

      // Don't show modal if deadline has passed
      if (isDeadlinePassed()) {
        setBatchRepChecked(true);
        return;
      }

      try {
        const res = await apiGet('/api/batch-rep/status');
        if (res.ok) {
          const data = await res.json();
          setBatchRepHasSubmitted(data.hasSubmitted);
          // Show modal if user has access, status is active, and deadline has not passed
          const hasAccess = checkPhaseAccess(user, data.isGrad);
          if (hasAccess && data.status === 'active' && !isDeadlinePassed()) {
            setShowBatchRepModal(true);
          }
        }
      } catch (err) {
        console.error('Error checking batch-rep status:', err);
      } finally {
        setBatchRepChecked(true);
      }
    };

    checkBatchRepStatus();
  }, [profile, user, batchRepChecked]);

  // Check if current user is System Admin (admin id=1)
  const checkSystemAdmin = async () => {
    try {
      const res = await apiGet('/api/permissions/me');
      if (res.ok) {
        const data = await res.json();
        // System admin is admin id=1
        if (data.is_super_admin && data.admin_id === 1) {
          setIsSystemAdmin(true);
        }
      }
    } catch (err) {
      console.error('Failed to check admin status');
    } finally {
      setCheckingAdmin(false);
    }
  };

  // Scroll to My Tasks section when navigated with scrollToMyTasks state
  useEffect(() => {
    if (location.state?.scrollToMyTasks) {
      // Wait a brief moment for the MyTasks component to render
      const timeout = setTimeout(() => {
        const myTasksSection = document.getElementById('my-tasks-section');
        if (myTasksSection) {
          myTasksSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // Add a brief highlight effect
          myTasksSection.style.transition = 'box-shadow 0.3s ease';
          myTasksSection.style.boxShadow = '0 0 0 3px rgba(207, 181, 59, 0.5)';
          setTimeout(() => {
            myTasksSection.style.boxShadow = '';
          }, 2000);
        }
      }, 500);
      // Clear the state to prevent re-scrolling on refresh
      window.history.replaceState({}, document.title);
      return () => clearTimeout(timeout);
    }
  }, [location.state]);

  const fetchMyEvents = async () => {
    try {
      const res = await apiGet('/api/events/my-rsvps');
      if (res.ok) {
        const data = await res.json();
        setMyEvents(data);
      }
    } catch (err) {
      console.error('Failed to fetch my events');
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await apiGet('/api/me');
      const data = await res.json();
      setProfile(data);
      setMerchForm({
        shirt_size: data.shirt_size || '',
        jacket_size: data.jacket_size || '',
      });
    } catch (err) {
      console.error('Failed to fetch profile');
    }
  };

  const handleRsvp = async (status) => {
    setRsvpSaving(true);
    setMessage('');

    try {
      const res = await apiPut('/api/me/rsvp', { status });

      if (res.ok) {
        setProfile({ ...profile, rsvp_status: status });
        setMessage('RSVP updated!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Failed to update RSVP');
    } finally {
      setRsvpSaving(false);
    }
  };

  const handleAlumniCard = async (hasCard) => {
    setAlumniCardSaving(true);
    try {
      const res = await apiPut('/api/me/alumni-card', { has_alumni_card: hasCard });
      if (res.ok) {
        setProfile({ ...profile, has_alumni_card: hasCard });
      }
    } catch (err) {
      console.error('Failed to update alumni card status');
    } finally {
      setAlumniCardSaving(false);
    }
  };

  const handleOpenMerchModal = () => {
    setMerchForm({ shirt_size: profile.shirt_size || '', jacket_size: profile.jacket_size || '' });
    setShowMerchModal(true);
  };

  const handleMerchSave = async () => {
    setMerchSaving(true);
    try {
      const res = await apiPut('/api/me/merch', merchForm);
      if (res.ok) {
        const data = await res.json();
        setProfile(prev => ({ ...prev, ...data }));
        setShowMerchModal(false);
        setMessage('Merch sizes saved!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Failed to save merch sizes');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setMerchSaving(false);
    }
  };

  if (!profile || checkingAdmin) {
    return (
      <div className="container admin-container">
        <div className="profile-loading">
          <div className="loading-spinner"></div>
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  // Show System Administrator view for admin id=1
  if (isSystemAdmin) {
    return <SystemAdminProfile />;
  }

  return (
    <div className="container admin-container">
      <Navbar />
      <div className="card">
        <main className="profile-main">
          {/* Welcome Banner */}
          <section className="profile-welcome">
            <div className="welcome-content">
              <div className="welcome-header-row">
                <div>
                  <h2>Welcome back, {profile.first_name}!</h2>
                  <p>Thank you for registering for our 25th Alumni Homecoming</p>
                </div>
                <button
                  onClick={() => setShowGuide(!showGuide)}
                  className="btn-guide"
                >
                  {showGuide ? 'Hide' : '📖 Guide'}
                </button>
              </div>
            </div>
          </section>

          {/* User Guide */}
          {showGuide && <UserGuide profile={profile} />}

          {message && (
            <div className="profile-message success">
              {message}
            </div>
          )}

          {/* My Tasks Section - Only shows for admins */}
          {user?.isAdmin && <MyTasks />}

          <div className="profile-grid">
            {/* Left Column */}
            <div className="profile-left">
              {/* Committee Strategy Document - Non-Registry Admins Only */}
              {(user?.is_super_admin || (user?.isAdmin && user?.hasNonRegistryPermissions)) && (
                <div className="profile-card strategy-card">
                  <button
                    className="strategy-toggle"
                    onClick={() => setShowStrategy(!showStrategy)}
                  >
                    <span className="strategy-toggle-text">🔒 Committee, Please Read — Contribution Plan</span>
                    <span className={`strategy-toggle-arrow ${showStrategy ? 'open' : ''}`}>
                      {showStrategy ? '▲' : '▼'}
                    </span>
                  </button>
                  {showStrategy && (
                    <div className="strategy-content">
                      <iframe
                        src="/presentations/Funding_Strategy_Visual.html"
                        title="Funding Strategy"
                        className="strategy-iframe"
                      />
                      <a
                        href="/presentations/Funding_Strategy_Visual.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="strategy-external-link"
                      >
                        Open in new tab ↗
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Builder Card - My Contribution */}
              {profile.is_graduate ? (
                <BuilderCard
                  profile={profile}
                  onProfileUpdate={(updates) => {
                    setProfile(prev => ({ ...prev, ...updates }));
                    setMessage('Builder tier saved!');
                    setTimeout(() => setMessage(''), 3000);
                  }}
                  user={user}
                />
              ) : (
                <div className="profile-card donate-card">
                  <div className="card-header">
                    <h3>Hi, {profile.first_name || 'Guest'}!</h3>
                  </div>
                  <p className="donate-message">
                    Thank you for being part of our 25th Homecoming celebration. Whether you graduated with us or not, you were part of that chapter and that will always matter.
                  </p>
                  <p className="donate-message">
                    We're grateful you're here to celebrate this milestone. Your presence is what truly counts.
                  </p>
                  <div className="donate-divider"></div>
                  <p className="donate-note">
                    Have questions or suggestions? Head to your <Link to="/inbox" className="donate-inbox-link">Inbox</Link> and contact the committee.
                  </p>
                </div>
              )}

              {/* RSVP Card - Main Event */}
              <RSVPCard
                profile={profile}
                rsvpSaving={rsvpSaving}
                onRsvp={handleRsvp}
              />

              {/* Alumni Card Nudge - Only show for graduates */}
              <AlumniCardNudge
                profile={profile}
                alumniCardSaving={alumniCardSaving}
                onAlumniCard={handleAlumniCard}
              />
            </div>

            {/* Right Column */}
            <div className="profile-right">
              {/* Your Information Card */}
              <InfoCard
                profile={profile}
                user={user}
                onSaved={(updated) => setProfile(prev => ({ ...prev, ...updated }))}
                onPhotoChange={(photo) => setProfile(prev => ({ ...prev, profile_photo: photo }))}
                onMessage={(msg) => { setMessage(msg); setTimeout(() => setMessage(''), 3000); }}
                onOpenMerchModal={handleOpenMerchModal}
              />

              {/* Merch Sizes Card */}
              <div className="profile-card merch-card">
                <div className="merch-card-header">
                  <span className="merch-card-title">Merch sizes</span>
                  <button className="btn-merch-edit" onClick={handleOpenMerchModal}>
                    {profile.shirt_size || profile.jacket_size ? 'Edit sizes' : 'Set sizes'}
                  </button>
                </div>
                <p className="merch-card-note">
                  We're planning exclusive batch merch for the reunion. Save your sizes so we have them ready when orders open.
                </p>
                <div className="merch-inline-display">
                  <div className="merch-inline-item">
                    <span className="merch-label">Shirt</span>
                    <span className={`merch-value ${!profile.shirt_size ? 'empty' : ''}`}>
                      {profile.shirt_size || 'Not set'}
                    </span>
                  </div>
                  <div className="merch-inline-item">
                    <span className="merch-label">Jacket</span>
                    <span className={`merch-value ${!profile.jacket_size ? 'empty' : ''}`}>
                      {profile.jacket_size || 'Not set'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Your Upcoming Events */}
              {myEvents.length > 0 && (
                <div className="profile-card my-events-card">
                  <div className="card-header">
                    <h3>Your Upcoming Events</h3>
                    <Link to="/events" className="btn-link">View All</Link>
                  </div>
                  <div className="my-events-list">
                    {myEvents.map(event => (
                      <div key={event.id} className="my-event-item">
                        <div className="my-event-date">
                          <span className="my-event-day">{formatEventDate(event.event_date).day}</span>
                          <span className="my-event-month">{formatEventDate(event.event_date).month}</span>
                        </div>
                        <div className="my-event-info">
                          <p className="my-event-title">{event.title}</p>
                          <p className="my-event-location">{event.location || 'Location TBD'}</p>
                        </div>
                        <span className={`my-event-status ${event.status}`}>
                          {event.status === 'going' ? 'Going' : 'Interested'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        </main>
      </div>
      <Footer />

      <MerchModal
        show={showMerchModal}
        merchForm={merchForm}
        onChange={setMerchForm}
        onSave={handleMerchSave}
        onClose={() => setShowMerchModal(false)}
        saving={merchSaving}
      />

      <BatchRepModal
        show={showBatchRepModal}
        profile={profile}
        batchRepHasSubmitted={batchRepHasSubmitted}
        onDismiss={() => setShowBatchRepModal(false)}
        onNavigate={() => navigate('/batch-rep')}
      />
    </div>
  );
}
