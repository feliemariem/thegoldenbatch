import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaFacebook, FaLinkedin, FaInstagram } from 'react-icons/fa';
import MyTasks from '../components/MyTasks';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import SystemAdminProfile from '../components/SystemAdminProfile';
import ContributionPlan from '../components/ContributionPlan';
import '../styles/profileNew.css';
import '../styles/batchrep.css';
import { apiGet, apiPut, apiUpload, apiDelete } from '../api';
import siteLogo from '../images/logo.png';

// Access control phases for batch-rep feature:
// Phase 1: Only felie@fnrcore.com
// Phase 2: All admins
// Phase 3: All registered graduates
const BATCH_REP_PHASE = 1;

// Check if user has access based on current phase
const checkPhaseAccess = (user, isGrad) => {
  if (!user) return false;

  const userEmail = user.email?.toLowerCase();

  switch (BATCH_REP_PHASE) {
    case 1:
      // Phase 1: Only specific emails
      const allowedEmails = [
        'felie@fnrcore.com'
      ];
      return allowedEmails.includes(userEmail);
    case 2:
      return user.isAdmin === true;
    case 3:
      return isGrad === true;
    default:
      return false;
  }
};

// Batch-rep deadline: March 14, 2026 at 8:00 AM PHT (UTC+8)
const BATCH_REP_DEADLINE = new Date('2026-03-14T08:00:00+08:00');

const isDeadlinePassed = () => {
  return new Date() > BATCH_REP_DEADLINE;
};

const getDaysUntilBatchRepDeadline = () => {
  const now = new Date();
  const diffTime = BATCH_REP_DEADLINE - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export default function ProfileNew() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [profile, setProfile] = useState(null);
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [myEvents, setMyEvents] = useState([]);
  const [showGuide, setShowGuide] = useState(false);
  const [showMerchModal, setShowMerchModal] = useState(false);
  const [merchForm, setMerchForm] = useState({ shirt_size: '', jacket_size: '' });
  const [merchSaving, setMerchSaving] = useState(false);
  const [alumniCardSaving, setAlumniCardSaving] = useState(false);
  const [calendarDropdownOpen, setCalendarDropdownOpen] = useState(false);
  const [showContributionPlan, setShowContributionPlan] = useState(false);
  const [scrollToTiers, setScrollToTiers] = useState(false);
  const [receipts, setReceipts] = useState([]);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [paymentMethodsOpen, setPaymentMethodsOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [receiptModalImage, setReceiptModalImage] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [showFullPaidDetails, setShowFullPaidDetails] = useState(false);
  const [showStrategy, setShowStrategy] = useState(false);
  const [showBatchRepModal, setShowBatchRepModal] = useState(false);
  const [batchRepChecked, setBatchRepChecked] = useState(false);
  const [batchRepHasSubmitted, setBatchRepHasSubmitted] = useState(false);
  const fileInputRef = useRef(null);
  const receiptFileInputRef = useRef(null);
  const calendarDropdownRef = useRef(null);

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    birthday: '',
    mobile: '',
    address: '',
    city: '',
    country: '',
    occupation: '',
    company: '',
    facebook_url: '',
    linkedin_url: '',
    instagram_url: '',
  });

  // Feature flag for new pages (Events, Directory, etc.)
  const showNewPages = process.env.REACT_APP_NEW_FEATURES === 'true';

  // Helper function to safely format event dates
  const formatEventDate = (dateStr) => {
    if (!dateStr) return { day: '?', month: '???' };

    const dateOnly = dateStr.split('T')[0];
    const date = new Date(dateOnly + 'T00:00:00');

    if (isNaN(date.getTime())) {
      return { day: '?', month: '???' };
    }

    return {
      day: date.getDate(),
      month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase()
    };
  };

  // Helper function to format peso amounts (handles cents)
  function formatPeso(amount) {
    const num = parseFloat(amount);
    if (Number.isNaN(num)) return '₱0';
    return num % 1 === 0
      ? `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 0 })}`
      : `₱${num.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  // Helper function to get milestone message based on payment percentage
  function getMilestoneMessage(percentage) {
    if (percentage === 0) return "Your pledge is set! Make your first payment to get started.";
    if (percentage < 25) return "Great start! Every peso counts.";
    if (percentage < 50) return "You're on your way!";
    if (percentage < 75) return "Halfway there — keep it up!";
    if (percentage < 100) return "Almost there — the finish line is in sight!";
    return "Pledge complete! Thank you for stepping up for our batch.";
  }

  // Helper function to format birthday without timezone conversion
  const formatBirthday = (dateStr) => {
    if (!dateStr) return '';
    // Extract just the date portion (YYYY-MM-DD) and parse at local midnight
    const dateOnly = dateStr.split('T')[0];
    const date = new Date(dateOnly + 'T00:00:00');
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  useEffect(() => {
    fetchProfile();
    fetchMyEvents();
    fetchReceipts();
    checkSystemAdmin();
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
          // Debug logging
          const hasAccess = checkPhaseAccess(user, data.isGrad);
          console.log('[BatchRep Modal Debug]', {
            apiResponse: data,
            hasAccess,
            statusIsActive: data.status === 'active',
            deadlinePassed: isDeadlinePassed(),
            userEmail: user?.email,
            shouldShow: hasAccess && data.status === 'active' && !isDeadlinePassed()
          });
          // Store submission state
          setBatchRepHasSubmitted(data.hasSubmitted);
          // Show modal if:
          // 1. User has phase access
          // 2. Status is active
          // 3. Deadline has not passed
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

  // Calculate days remaining until the reunion (Dec 16, 2028)
  const getDaysUntilReunion = () => {
    const reunionDate = new Date('2028-12-16');  // Reunion date
    const today = new Date();                     // Current date
    const diffTime = reunionDate - today;         // Difference in milliseconds
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));  // Convert ms to days
    return diffDays;  // Positive = days left, 0 = today, negative = past
  };

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

  // Check for openPlan URL parameter to auto-open ContributionPlan modal
  useEffect(() => {
    if (profile && profile.is_graduate) {
      const params = new URLSearchParams(location.search);
      if (params.get('openPlan') === 'true') {
        setShowContributionPlan(true);
        // Clear the param from URL to prevent re-opening on refresh
        window.history.replaceState({}, document.title, location.pathname);
      }
    }
  }, [profile, location.search, location.pathname]);

  // Close calendar dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarDropdownRef.current && !calendarDropdownRef.current.contains(event.target)) {
        setCalendarDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Generate .ics file for Apple Calendar
  const downloadICS = () => {
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//USLS-IS Batch 2003//EN
BEGIN:VEVENT
DTSTART:20281216T090000
DTEND:20281217T000000
SUMMARY:USLS-IS Batch 2003 - 25th Alumni Homecoming
LOCATION:Santuario de La Salle, USLS, Bacolod City
DESCRIPTION:25th Alumni Homecoming of USLS-IS Batch 2003. The Golden Batch.
END:VEVENT
END:VCALENDAR`;
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'USLS-IS-2003-Reunion.ics';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    setCalendarDropdownOpen(false);
  };

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

  const fetchReceipts = async () => {
    try {
      const res = await apiGet('/api/receipts/my');
      if (res.ok) {
        const data = await res.json();
        setReceipts(data.receipts || []);
      }
    } catch (err) {
      console.error('Failed to fetch receipts');
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileSelect(file);
    }
  };

  const handleFileSelect = (file) => {
    if (!file.type.startsWith('image/')) {
      setMessage('Please select an image file');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage('Image must be less than 5MB');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setReceiptPreview({ file, previewUrl: e.target.result });
    };
    reader.readAsDataURL(file);
  };

  const handleReceiptFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const confirmUpload = async () => {
    if (!receiptPreview) return;

    setReceiptUploading(true);
    const formData = new FormData();
    formData.append('receipt', receiptPreview.file);

    try {
      const res = await apiUpload('/api/receipts', formData);

      if (res.ok) {
        fetchReceipts();
        setMessage('Receipt uploaded! We will verify it within 48 hours.');
        setTimeout(() => setMessage(''), 4000);
      } else {
        setMessage('Failed to upload receipt');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Failed to upload receipt');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setReceiptUploading(false);
      setReceiptPreview(null);
      if (receiptFileInputRef.current) {
        receiptFileInputRef.current.value = '';
      }
    }
  };

  const cancelUpload = () => {
    setReceiptPreview(null);
    if (receiptFileInputRef.current) {
      receiptFileInputRef.current.value = '';
    }
  };

  const handleDeleteReceipt = async (receiptId) => {
    setDeleting(true);
    try {
      const res = await apiDelete(`/api/receipts/${receiptId}`);
      if (res.ok) {
        fetchReceipts();
        setMessage('Receipt deleted');
        setTimeout(() => setMessage(''), 3000);
      } else {
        const data = await res.json();
        setMessage(data.error || 'Failed to delete receipt');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Failed to delete receipt');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await apiGet('/api/me');
      const data = await res.json();
      setProfile(data);
      setForm({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        birthday: data.birthday ? data.birthday.split('T')[0] : '',
        mobile: data.mobile || '',
        address: data.address || '',
        city: data.city || '',
        country: data.country || '',
        occupation: data.occupation || '',
        company: data.company || '',
        facebook_url: data.facebook_url || '',
        linkedin_url: data.linkedin_url || '',
        instagram_url: data.instagram_url || '',
      });
      setMerchForm({
        shirt_size: data.shirt_size || '',
        jacket_size: data.jacket_size || '',
      });
    } catch (err) {
      console.error('Failed to fetch profile');
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const res = await apiPut('/api/me', form);

      if (res.ok) {
        const data = await res.json();
        setProfile({ ...profile, ...data });
        setEditing(false);
        setMessage('Profile updated!');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Failed to save');
    } finally {
      setSaving(false);
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

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setMessage('Please select an image file');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Image must be less than 5MB');
      setTimeout(() => setMessage(''), 3000);
      return;
    }

    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await apiUpload('/api/me/photo', formData);

      if (res.ok) {
        const data = await res.json();
        setProfile({ ...profile, profile_photo: data.profile_photo });
        setMessage('Photo uploaded!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to upload photo');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Failed to upload photo');
      setTimeout(() => setMessage(''), 3000);
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async () => {
    try {
      const res = await apiDelete('/api/me/photo');

      if (res.ok) {
        setProfile({ ...profile, profile_photo: null });
        setMessage('Photo removed');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (err) {
      setMessage('Failed to remove photo');
      setTimeout(() => setMessage(''), 3000);
    }
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

  const paymentProgress = profile.amount_due > 0
    ? Math.min((profile.total_paid / profile.amount_due) * 100, 100)
    : 0;

  const paymentStatus = profile.total_paid >= profile.amount_due
    ? 'Full'
    : profile.total_paid > 0
      ? 'Partial'
      : 'Unpaid';

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
          {showGuide && (
            <div className="user-guide-section">
              <h3 className="guide-title">Welcome to The Golden Batch!</h3>

              <div className="guide-content">
                <div className="guide-item">
                  <h4>Your Profile:</h4>
                  <ul>
                    <li>Update your personal information and upload a profile photo</li>
                    <li>Your info helps batchmates reconnect with you</li>
                  </ul>
                </div>

                <div className="guide-item">
                  <h4>RSVP:</h4>
                  <ul>
                    <li>Let us know if you're attending the 25th Alumni Homecoming</li>
                    <li>You can change your RSVP anytime</li>
                  </ul>
                </div>

                {profile.is_graduate && (
                  <div className="guide-item">
                    <h4>Payment Status:</h4>
                    <ul>
                      <li>Track your contribution progress</li>
                      <li>View payment details in the Funds page</li>
                    </ul>
                  </div>
                )}

                <div className="guide-item">
                  <h4>Events:</h4>
                  <ul>
                    <li>Browse upcoming batch events and activities</li>
                    <li>RSVP to events you want to attend</li>
                  </ul>
                </div>

                <div className="guide-item">
                  <h4>Media:</h4>
                  <ul>
                    <li>View photos and videos from past reunions and high school days</li>
                    <li>Watch featured hype videos and podcast episodes</li>
                    <li>Read batch news and spotlight interviews</li>
                    <li>Browse the gallery for throwback memories</li>
                  </ul>
                </div>

                {profile.is_graduate && (
                  <div className="guide-item">
                    <h4>Funds:</h4>
                    <ul>
                      <li>View the batch's fundraising progress</li>
                      <li>See contribution history and how funds are being used</li>
                    </ul>
                  </div>
                )}

                <div className="guide-item">
                  <h4>Inbox:</h4>
                  <ul>
                    <li>Receive announcements from the committee</li>
                    <li>Reply to the committee directly from your inbox</li>
                    <li>Send suggestions or feedback to the organizers</li>
                  </ul>
                </div>

                <div className="guide-item">
                  <h4>Committee:</h4>
                  <ul>
                    <li>See who's organizing the reunion</li>
                    <li>Volunteer to help out</li>
                  </ul>
                </div>

                <div className="guide-tip">
                  <span className="tip-icon">💡</span>
                  <strong>Tip:</strong> Have questions or suggestions? Go to your Inbox and click "Contact Committee" to reach the organizers!
                </div>
              </div>
            </div>
          )}

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
              {/* Committee Strategy Document - Admin Only */}
              {user?.isAdmin && (
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
              !profile.builder_tier ? (
                <div className="profile-card builder-card">
                  <div className="card-header">
                    <h3>My Contribution</h3>
                  </div>
                  <p className="builder-intro-text">
                    <span className="builder-intro-name">{profile.first_name}</span>, this is our 25-year milestone. It belongs to all of us. Every contribution, big or small, helps us build something worthy of where we started and how far we've come.
                  </p>
                  <button className="btn-view-plan" onClick={() => { setShowContributionPlan(true); setScrollToTiers(false); }}>
                    View Contribution Plan
                  </button>
                </div>
              ) : (
                <div className="profile-card builder-card has-tier">
                  <div className="card-header">
                    <h3>My Contribution</h3>
                  </div>
                  <div className={`builder-tier-badge ${profile.builder_tier}`}>
                    {profile.builder_tier.charAt(0).toUpperCase() + profile.builder_tier.slice(1)}
                    {profile.builder_tier !== 'root' && profile.pledge_amount && (
                      <span className="badge-amount">· {formatPeso(profile.pledge_amount)}</span>
                    )}
                  </div>

                  {profile.builder_tier !== 'root' && profile.pledge_amount ? (
                    <>
                      <div className="builder-progress">
                        <div className="builder-progress-bar">
                          <div
                            className="builder-progress-fill"
                            style={{ width: `${Math.min(((profile.total_paid || 0) / profile.pledge_amount) * 100, 100)}%` }}
                          ></div>
                        </div>
                        <div className="builder-progress-text">
                          <span className="builder-paid">{formatPeso(profile.total_paid || 0)}</span>
                          <span className="builder-total">/ {formatPeso(profile.pledge_amount)}</span>
                          <span className="builder-pct">({Math.min(Math.round(((profile.total_paid || 0) / profile.pledge_amount) * 100), 100)}%)</span>
                        </div>
                        {(profile.pending_paid || 0) > 0 && (
                          <div className="builder-pending">
                            +{formatPeso(profile.pending_paid)} pending verification
                          </div>
                        )}
                        {(profile.total_paid || 0) < (profile.pledge_amount || 0) && (
                          <div className="builder-remaining">
                            Remaining: <strong>{formatPeso((profile.pledge_amount || 0) - (profile.total_paid || 0))}</strong>
                          </div>
                        )}
                        <div className="builder-milestone-message">
                          {getMilestoneMessage(Math.round(((profile.total_paid || 0) / profile.pledge_amount) * 100))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="builder-root-status">
                      <span className="root-message">{formatPeso(profile.total_paid || 0)} contributed. Every peso counts — thank you!</span>
                      {(profile.pending_paid || 0) > 0 && (
                        <div className="builder-pending" style={{ marginTop: '8px' }}>
                          +{formatPeso(profile.pending_paid)} pending verification
                        </div>
                      )}
                    </div>
                  )}

                  {/* Check if fully paid (non-root tier) */}
                  {(() => {
                    const isFullyPaid = profile.builder_tier !== 'root' &&
                      profile.pledge_amount &&
                      parseFloat(profile.total_paid || 0) >= parseFloat(profile.pledge_amount);

                    // Content for receipt upload, payment methods, and receipt history
                    const detailsContent = (
                      <>
                        {/* Receipt Upload - Drag & Drop Zone */}
                        {/* Show upload zone for root tier OR when not fully paid */}
                        {(profile.builder_tier === 'root' ||
                          !profile.pledge_amount ||
                          (profile.total_paid || 0) < profile.pledge_amount) && (
                          <>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleReceiptFileChange}
                              ref={receiptFileInputRef}
                              style={{ display: 'none' }}
                              id="receipt-upload"
                            />
                            {!receiptPreview ? (
                              <div
                                className={`receipt-dropzone ${dragActive ? 'drag-active' : ''}`}
                                onDragEnter={handleDrag}
                                onDragLeave={handleDrag}
                                onDragOver={handleDrag}
                                onDrop={handleDrop}
                                onClick={() => receiptFileInputRef.current?.click()}
                              >
                                <div className="dropzone-icon">📤</div>
                                <div className="dropzone-text">
                                  <span className="dropzone-primary">Drop receipt image here</span>
                                  <span className="dropzone-secondary">or click to browse</span>
                                </div>
                              </div>
                            ) : (
                              <div className="receipt-preview-zone">
                                <img src={receiptPreview.previewUrl} alt="Preview" className="preview-image" />
                                <div className="preview-actions">
                                  <button
                                    className="btn-preview-confirm"
                                    onClick={confirmUpload}
                                    disabled={receiptUploading}
                                  >
                                    {receiptUploading ? 'Uploading...' : 'Upload'}
                                  </button>
                                  <button
                                    className="btn-preview-cancel"
                                    onClick={cancelUpload}
                                    disabled={receiptUploading}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {/* Payment Methods Toggle */}
                        <div className="payment-methods-toggle">
                          <button
                            className={`toggle-btn ${paymentMethodsOpen ? 'open' : ''}`}
                            onClick={() => setPaymentMethodsOpen(!paymentMethodsOpen)}
                          >
                            Payment Methods <span className="toggle-arrow">{paymentMethodsOpen ? '▲' : '▼'}</span>
                          </button>
                          {paymentMethodsOpen && (
                            <div className="payment-methods-content">
                              <div className="payment-method-item">
                                <div className="method-label">Bank Deposit</div>
                                <div className="method-detail"><span>Bank:</span> Philippine National Bank (PNB)</div>
                                <div className="method-detail"><span>Account Names:</span> Narciso Javelosa III or Mary Rose Frances Uy</div>
                                <div className="method-detail"><span>Account Number:</span> 307770014898</div>
                              </div>
                              <div className="payment-method-item">
                                <div className="method-label">International Transfers (Swift)</div>
                                <div className="method-detail"><span>Bank:</span> PNB Bacolod Lacson Branch</div>
                                <div className="method-detail"><span>Address:</span> 10th Lacson Street, Bacolod City, Negros Occidental 6100</div>
                                <div className="method-detail"><span>Tel:</span> (63) (034) 432-0605 / 434-8007</div>
                                <div className="method-detail"><span>SWIFT Code:</span> PNBMPHMM</div>
                                <div className="method-detail"><span>Routing No.:</span> 040080019</div>
                                <div className="method-detail"><span>Email:</span> bacolod_lacson@pnb.com.ph</div>
                                <div className="method-detail"><span>Website:</span> pnb.com.ph</div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Receipt History */}
                        {receipts.length > 0 && (
                          <div className="builder-receipt-list">
                            <h4>Receipt History</h4>
                            <div className="receipt-list-scroll">
                              {receipts.map(receipt => (
                                <div key={receipt.id} className="receipt-row">
                                  <button
                                    className="receipt-thumb"
                                    onClick={() => setReceiptModalImage(receipt.image_url)}
                                    type="button"
                                  >
                                    <img src={receipt.image_url} alt="Receipt" />
                                  </button>
                                  <div className="receipt-info">
                                    <span className="receipt-date">
                                      {new Date(receipt.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                    <span className={`receipt-source-badge ${receipt.source}`}>
                                      {receipt.source === 'user' ? 'You' : 'Committee'}
                                    </span>
                                  </div>
                                  <span className={`receipt-status-badge ${receipt.status}`}>
                                    {receipt.status === 'submitted'
                                      ? 'Submitted'
                                      : receipt.status === 'verified'
                                        ? 'Verified'
                                        : 'Pending Verification'}
                                  </span>
                                  {receipt.ledger_id && (
                                    <span className={`receipt-verified-badge ${receipt.ledger_status === 'OK' ? 'verified' : 'pending'}`}>
                                      {receipt.ledger_status === 'OK' ? '✓ Verified' : 'Pending'}
                                      {receipt.ledger_amount && ` · ₱${parseFloat(receipt.ledger_amount).toLocaleString()}`}
                                    </span>
                                  )}
                                  {receipt.status === 'submitted' && receipt.source === 'user' && (
                                    deleteConfirmId === receipt.id ? (
                                      <div className="receipt-delete-confirm">
                                        <span>Delete this receipt? You can upload a new one after.</span>
                                        <button
                                          className="btn-delete-yes"
                                          onClick={() => handleDeleteReceipt(receipt.id)}
                                          disabled={deleting}
                                        >
                                          Delete
                                        </button>
                                        <button
                                          className="btn-delete-no"
                                          onClick={() => setDeleteConfirmId(null)}
                                          disabled={deleting}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        className="btn-delete-receipt"
                                        onClick={() => setDeleteConfirmId(receipt.id)}
                                        title="Delete this receipt"
                                      >
                                        ✕
                                      </button>
                                    )
                                  )}
                                </div>
                              ))}
                            </div>
                            {receipts.some(r => r.status === 'submitted') && (
                              <p className="receipt-pending-note">
                                Your receipt has been submitted. The committee will verify and credit your account within 48 hours.
                              </p>
                            )}
                          </div>
                        )}
                        {receipts.length === 0 && !isFullyPaid && (
                          <p className="no-receipts-text">No receipts yet. Upload a receipt after making a payment.</p>
                        )}
                      </>
                    );

                    return isFullyPaid ? (
                      <>
                        {/* Toggle link for fully paid users */}
                        <button
                          className="btn-show-details"
                          onClick={() => setShowFullPaidDetails(!showFullPaidDetails)}
                        >
                          {showFullPaidDetails ? 'Hide Details' : 'Show Details'} <span className="toggle-arrow">{showFullPaidDetails ? '▲' : '▼'}</span>
                        </button>

                        {/* Collapsible details section */}
                        {showFullPaidDetails && (
                          <div className="full-paid-details">
                            {detailsContent}
                          </div>
                        )}
                      </>
                    ) : (
                      // Show everything expanded when not fully paid
                      detailsContent
                    );
                  })()}

                  <div className="builder-links">
                    <button className="btn-link-text" onClick={() => { setShowContributionPlan(true); setScrollToTiers(true); }}>Change Tier</button>
                    <span className="link-separator">·</span>
                    <button className="btn-link-text" onClick={() => { setShowContributionPlan(true); setScrollToTiers(false); }}>View Full Plan</button>
                  </div>
                </div>
              )
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
              <div className="profile-card rsvp-card">
                <div className="card-header">
                  <h3>Main Event</h3>
                </div>
                <div className="event-details">
                  <div className="event-date">
                    <span className="event-day">16</span>
                    <span className="event-month">DEC</span>
                    <span className="event-year">2028</span>
                  </div>
                  <div className="event-info">
                    <p className="event-name">25th Alumni Homecoming</p>
                    <p className="event-location">Santuario de La Salle, USLS, Bacolod City</p>
                    <div className="calendar-dropdown" ref={calendarDropdownRef}>
                      <button
                        className="calendar-dropdown-btn"
                        onClick={() => setCalendarDropdownOpen(!calendarDropdownOpen)}
                      >
                        📅 Add to Calendar <span className={`dropdown-arrow ${calendarDropdownOpen ? 'open' : ''}`}>▼</span>
                      </button>
                      {calendarDropdownOpen && (
                        <div className="calendar-dropdown-menu">
                          <a
                            href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=USLS-IS+Batch+2003+25th+Alumni+Homecoming&dates=20281216T090000/20281217T000000&location=Santuario+de+La+Salle,+USLS,+Bacolod+City&details=25th+Alumni+Homecoming+of+USLS-IS+Batch+2003.+The+Golden+Batch."
                            target="_blank"
                            rel="noopener noreferrer"
                            className="calendar-option"
                            onClick={() => setCalendarDropdownOpen(false)}
                          >
                            Google Calendar
                          </a>
                          <button className="calendar-option" onClick={downloadICS}>
                            Apple Calendar
                          </button>
                          <a
                            href="https://outlook.live.com/calendar/0/action/compose?subject=USLS-IS+Batch+2003+25th+Alumni+Homecoming&startdt=2028-12-16T09:00:00&enddt=2028-12-17T00:00:00&location=Santuario+de+La+Salle,+USLS,+Bacolod+City&body=25th+Alumni+Homecoming+of+USLS-IS+Batch+2003.+The+Golden+Batch."
                            target="_blank"
                            rel="noopener noreferrer"
                            className="calendar-option"
                            onClick={() => setCalendarDropdownOpen(false)}
                          >
                            Outlook
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <p className="rsvp-label">Update RSVP</p>
                <div className="rsvp-row">
                  <div className="countdown-box">
                    {getDaysUntilReunion() > 0 ? (
                      <>
                        <span className="countdown-days">{getDaysUntilReunion()}</span>
                        <span className="countdown-label">Days Left!</span>
                      </>
                    ) : getDaysUntilReunion() === 0 ? (
                      <span className="countdown-label countdown-today">Today is the day!</span>
                    ) : (
                      <span className="countdown-label countdown-passed">The reunion has happened!</span>
                    )}
                  </div>
                  <div className="rsvp-buttons">
                    <button
                      className={`btn-rsvp ${profile.rsvp_status === 'going' ? 'active going' : ''}`}
                      onClick={() => handleRsvp('going')}
                      disabled={rsvpSaving}
                    >
                      Going
                    </button>
                    <button
                      className={`btn-rsvp ${profile.rsvp_status === 'maybe' ? 'active maybe' : ''}`}
                      onClick={() => handleRsvp('maybe')}
                      disabled={rsvpSaving}
                    >
                      Maybe
                    </button>
                    <button
                      className={`btn-rsvp ${profile.rsvp_status === 'not_going' ? 'active not-going' : ''}`}
                      onClick={() => handleRsvp('not_going')}
                      disabled={rsvpSaving}
                    >
                      Can't Make It
                    </button>
                  </div>
                </div>
                <Link to="/events" className="rsvp-card-events-link">View All Events →</Link>
              </div>

              {/* Alumni Card Nudge - Only show for graduates */}
              {profile.section && profile.section !== 'Non-Graduate' && (
              <div className="profile-card alumni-card-nudge">
                <div className="card-header">
                  <h3>🎓 USLS Alumni Card</h3>
                </div>
                {!profile.has_alumni_card ? (
                  <div className="alumni-card-row">
                    <div className="alumni-card-mini">
                      <div className="alumni-card-header">
                        <img src={require('../images/usls-seal.jpg')} alt="USLS Seal" className="alumni-card-seal" />
                        <div className="alumni-card-header-text">
                          <span>University of St. La Salle</span>
                          <span>Alumni Association</span>
                        </div>
                      </div>
                      <div className="alumni-card-name">
                        {(profile.first_name && profile.last_name)
                          ? `${profile.first_name} ${profile.last_name}`.toUpperCase()
                          : 'YOUR NAME HERE'}
                      </div>
                      <div className="alumni-card-bottom-right">
                        <div className="alumni-card-photo-placeholder"></div>
                        <div className="alumni-card-batch">
                          <span>HS Batch 2003</span>
                          <span>GS Batch 1999</span>
                        </div>
                      </div>
                      <div className="alumni-card-stripe">Lifetime Membership</div>
                    </div>
                    <div className="alumni-card-cta">
                      <p className="alumni-card-message">
                        <strong>{profile.first_name || 'Batchmate'}</strong>, make it official. Become a lifetime USLSAA member and enjoy alumni benefits and privileges.
                      </p>
                      <a
                        href="https://sites.google.com/usls.edu.ph/uslscare/alumni-card"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-apply-card"
                      >
                        Apply Now →
                      </a>
                      <button
                        className="btn-have-card"
                        onClick={() => handleAlumniCard(true)}
                        disabled={alumniCardSaving}
                      >
                        I already have mine
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="alumni-card-holder">
                    <div className="alumni-card-check">
                      <span className="check-icon">✓</span>
                    </div>
                    <div className="alumni-card-holder-text">
                      <strong>Alumni Card Holder</strong>
                      <span>You're a lifetime USLSAA member!</span>
                    </div>
                    <button
                      className="btn-undo-card"
                      onClick={() => handleAlumniCard(false)}
                      disabled={alumniCardSaving}
                    >
                      Undo
                    </button>
                  </div>
                )}
              </div>
              )}
            </div>

            {/* Right Column */}
            <div className="profile-right">
              {/* Your Information Card */}
              <div className="profile-card info-card">
                <div className="card-header">
                  <h3>Your Information</h3>
                  {!editing && (
                    <button onClick={() => setEditing(true)} className="btn-edit">
                      Edit
                    </button>
                  )}
                </div>

                {/* Profile Photo Section */}
                <div className="profile-photo-section">
                  <div className="profile-photo-container">
                    {profile.profile_photo ? (
                      <img
                        src={profile.profile_photo}
                        alt={`${profile.first_name}'s photo`}
                        className="profile-photo-img"
                      />
                    ) : (
                      <div className="profile-photo-initials">
                        {profile.first_name?.charAt(0)}{profile.last_name?.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="profile-photo-actions">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      ref={fileInputRef}
                      style={{ display: 'none' }}
                      id="photo-upload"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="btn-photo-upload"
                      disabled={uploadingPhoto}
                    >
                      {uploadingPhoto ? 'Uploading...' : profile.profile_photo ? 'Change Photo' : 'Upload Photo'}
                    </button>
                    {profile.profile_photo && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="btn-photo-remove"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {editing ? (
                  <form onSubmit={handleSave} className="edit-form">
                    <div className="form-grid">
                      <div className="form-group">
                        <label>First Name</label>
                        <input
                          type="text"
                          name="first_name"
                          value={form.first_name}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Last Name</label>
                        <input
                          type="text"
                          name="last_name"
                          value={form.last_name}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Birthday</label>
                        <input
                          type="date"
                          name="birthday"
                          value={form.birthday}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="form-group">
                        <label>Mobile</label>
                        <input
                          type="tel"
                          name="mobile"
                          value={form.mobile}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="form-group full-width">
                        <label>Address</label>
                        <input
                          type="text"
                          name="address"
                          value={form.address}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="form-group">
                        <label>City</label>
                        <input
                          type="text"
                          name="city"
                          value={form.city}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Country</label>
                        <input
                          type="text"
                          name="country"
                          value={form.country}
                          onChange={handleChange}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label>Occupation</label>
                        <input
                          type="text"
                          name="occupation"
                          value={form.occupation}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="form-group">
                        <label>Company</label>
                        <input
                          type="text"
                          name="company"
                          value={form.company}
                          onChange={handleChange}
                        />
                      </div>
                      <div className="form-group full-width social-media-section">
                        <label className="social-media-label">Social Media</label>
                        <div className="social-media-inputs">
                          <div className="social-input-group">
                            <label>Facebook username</label>
                            <input
                              type="text"
                              name="facebook_url"
                              value={form.facebook_url}
                              onChange={handleChange}
                              placeholder="yourname"
                            />
                          </div>
                          <div className="social-input-group">
                            <label>LinkedIn username</label>
                            <input
                              type="text"
                              name="linkedin_url"
                              value={form.linkedin_url}
                              onChange={handleChange}
                              placeholder="yourname"
                            />
                          </div>
                          <div className="social-input-group">
                            <label>Instagram handle</label>
                            <input
                              type="text"
                              name="instagram_url"
                              value={form.instagram_url}
                              onChange={handleChange}
                              placeholder="yourname"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="form-actions">
                      <button type="submit" className="btn-save" disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button type="button" onClick={() => setEditing(false)} className="btn-cancel">
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="info-display">
                    <div className="info-grid">
                      {(profile.first_name || profile.last_name) && (
                        <div className="info-item">
                          <span className="info-label">Name</span>
                          <span className="info-value">{profile.first_name} {profile.last_name}</span>
                        </div>
                      )}
                      {profile.email && (
                        <div className="info-item">
                          <span className="info-label">Email</span>
                          <span className="info-value">{profile.email}</span>
                        </div>
                      )}
                      {profile.birthday && (
                        <div className="info-item">
                          <span className="info-label">Birthday</span>
                          <span className="info-value">{formatBirthday(profile.birthday)}</span>
                        </div>
                      )}
                      {profile.mobile && (
                        <div className="info-item">
                          <span className="info-label">Mobile</span>
                          <span className="info-value">{profile.mobile}</span>
                        </div>
                      )}
                      {profile.address && (
                        <div className="info-item full-width">
                          <span className="info-label">Address</span>
                          <span className="info-value">{profile.address}</span>
                        </div>
                      )}
                      {(profile.city || profile.country) && (
                        <div className="info-item">
                          <span className="info-label">Location</span>
                          <span className="info-value">
                            {profile.city && profile.country
                              ? `${profile.city}, ${profile.country}`
                              : profile.city || profile.country}
                          </span>
                        </div>
                      )}
                      {profile.occupation && (
                        <div className="info-item">
                          <span className="info-label">Occupation</span>
                          <span className="info-value">{profile.occupation}</span>
                        </div>
                      )}
                      {profile.company && (
                        <div className="info-item">
                          <span className="info-label">Company</span>
                          <span className="info-value">{profile.company}</span>
                        </div>
                      )}
                    </div>
                    {(profile.facebook_url || profile.linkedin_url || profile.instagram_url) && (
                      <div className="social-icons-row">
                        {profile.facebook_url && (
                          <a
                            href={`https://facebook.com/${profile.facebook_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="social-icon-link facebook"
                            title="Facebook"
                          >
                            <FaFacebook />
                          </a>
                        )}
                        {profile.linkedin_url && (
                          <a
                            href={`https://linkedin.com/in/${profile.linkedin_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="social-icon-link linkedin"
                            title="LinkedIn"
                          >
                            <FaLinkedin />
                          </a>
                        )}
                        {profile.instagram_url && (
                          <a
                            href={`https://instagram.com/${profile.instagram_url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="social-icon-link instagram"
                            title="Instagram"
                          >
                            <FaInstagram />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Merch Sizes Section */}
                    <div className="merch-section">
                      <div className="merch-section-divider">
                        <span>Merch Sizes</span>
                      </div>
                      <p className="merch-section-note">
                        We're planning exclusive batch merch for the reunion! Save your sizes so we have them ready when orders open.
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
                        <button
                          className="btn-merch-edit"
                          onClick={() => {
                            setMerchForm({
                              shirt_size: profile.shirt_size || '',
                              jacket_size: profile.jacket_size || '',
                            });
                            setShowMerchModal(true);
                          }}
                        >
                          {profile.shirt_size || profile.jacket_size ? 'Edit Sizes' : 'Set Sizes'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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

      {showMerchModal && (
        <div className="modal-overlay" onClick={(e) => {
          if (e.target === e.currentTarget) setShowMerchModal(false);
        }}>
          <div className="merch-modal">
            <div className="merch-modal-header">
              <h3>Merch Preferences</h3>
              <button className="merch-modal-close" onClick={() => setShowMerchModal(false)}>✕</button>
            </div>

            <p className="merch-modal-note">
              We're planning exclusive batch merch for the reunion! Save your sizes now so we have them ready when orders open.
            </p>

            <div className="merch-modal-form">
              <div className="merch-form-group">
                <label>Shirt Size</label>
                <select
                  value={merchForm.shirt_size}
                  onChange={(e) => setMerchForm({ ...merchForm, shirt_size: e.target.value })}
                >
                  <option value="">— Select —</option>
                  <option value="XS">XS</option>
                  <option value="S">Small</option>
                  <option value="M">Medium</option>
                  <option value="L">Large</option>
                  <option value="XL">XL</option>
                  <option value="2XL">2XL</option>
                  <option value="3XL">3XL</option>
                </select>
              </div>

              <div className="merch-form-group">
                <label>Jacket Size</label>
                <select
                  value={merchForm.jacket_size}
                  onChange={(e) => setMerchForm({ ...merchForm, jacket_size: e.target.value })}
                >
                  <option value="">— Select —</option>
                  <option value="XS">XS</option>
                  <option value="S">Small</option>
                  <option value="M">Medium</option>
                  <option value="L">Large</option>
                  <option value="XL">XL</option>
                  <option value="2XL">2XL</option>
                  <option value="3XL">3XL</option>
                </select>
              </div>

              <p className="merch-form-hint">You can always update this later.</p>

              <div className="merch-form-actions">
                <button
                  className="btn-save"
                  onClick={handleMerchSave}
                  disabled={merchSaving}
                >
                  {merchSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  className="btn-cancel"
                  onClick={() => setShowMerchModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {profile.is_graduate && showContributionPlan && (
        <ContributionPlan
          isOpen={showContributionPlan}
          onClose={() => { setShowContributionPlan(false); setScrollToTiers(false); }}
          scrollToTiers={scrollToTiers}
          onTierSaved={(tier, pledge) => {
            setProfile(prev => ({
              ...prev,
              builder_tier: tier,
              pledge_amount: pledge,
              builder_tier_set_at: new Date().toISOString()
            }));
            setShowContributionPlan(false);
            setMessage('Builder tier saved!');
            setTimeout(() => setMessage(''), 3000);
          }}
          currentTier={profile.builder_tier}
          currentPledge={profile.pledge_amount}
          user={user}
        />
      )}

      {/* Receipt Image Modal */}
      {receiptModalImage && (
        <div className="receipt-modal-overlay" onClick={() => setReceiptModalImage(null)}>
          <div className="receipt-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="receipt-modal-close" onClick={() => setReceiptModalImage(null)}>✕</button>
            <img src={receiptModalImage} alt="Receipt" />
          </div>
        </div>
      )}

      {/* Batch Rep Announcement Modal - blocks profile until user responds */}
      {showBatchRepModal && (
        <div className="batchrep-modal-overlay">
          <div className="batchrep-modal">
            <div className="batchrep-modal-bar"></div>
            <div className="batchrep-modal-body">
              {batchRepHasSubmitted ? (
                <>
                  <div className="batchrep-modal-badge submitted">✓ Response Recorded</div>
                  <h2 className="batchrep-modal-title">Hi {profile?.first_name || 'there'}, you've already responded.</h2>
                  <p className="batchrep-modal-desc">
                    Changed your mind? You can update your response anytime before the deadline.
                  </p>
                  <button
                    className="batchrep-modal-btn"
                    onClick={() => navigate('/batch-rep')}
                  >
                    Update My Response →
                  </button>
                  <button
                    className="batchrep-modal-dismiss"
                    onClick={() => setShowBatchRepModal(false)}
                  >
                    Dismiss
                  </button>
                </>
              ) : (
                <>
                  <div className="batchrep-modal-badge">⚡ Quick Batch Input</div>
                  <h2 className="batchrep-modal-title">Hi {profile?.first_name || 'there'}, the batch needs to hear from you.</h2>
                  <p className="batchrep-modal-desc">
                    The organizing committee has been working behind the scenes to lay the groundwork. Now it's time for the batch to choose who will represent Batch 2003 for <strong>two official positions</strong>.
                  </p>
                  <div className="batchrep-modal-nominees">
                    <div className="batchrep-modal-nominee">
                      <div className="batchrep-modal-nominee-avatar initials">BJ</div>
                      <div className="batchrep-modal-nominee-info">
                        <div className="batchrep-modal-nominee-label">Alumni Association Representative</div>
                        <div className="batchrep-modal-nominee-name">Bianca Jison</div>
                      </div>
                    </div>
                    <div className="batchrep-modal-nominee">
                      <div className="batchrep-modal-nominee-avatar initials">FM</div>
                      <div className="batchrep-modal-nominee-info">
                        <div className="batchrep-modal-nominee-label">Batch Representative</div>
                        <div className="batchrep-modal-nominee-name">Felie Magbanua</div>
                      </div>
                    </div>
                  </div>
                  <div className="batchrep-modal-deadline">
                    🕐 Feedback window closes <span className="deadline-date">March 14, 2026 at 8:00 AM PHT</span>
                    {getDaysUntilBatchRepDeadline() > 0 && (
                      <span className="deadline-countdown"> · {getDaysUntilBatchRepDeadline()} day{getDaysUntilBatchRepDeadline() !== 1 ? 's' : ''} left</span>
                    )}
                  </div>
                  <button
                    className="batchrep-modal-btn"
                    onClick={() => navigate('/batch-rep')}
                  >
                    Submit My Response →
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}