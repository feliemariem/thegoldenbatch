import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../images/lasalle.jpg';

export default function Profile() {
  const { user, token, logout, setUser } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [message, setMessage] = useState('');

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
    rsvp_status: '',
  });

  useEffect(() => {
    fetchProfile();
  }, [token]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
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
        rsvp_status: data.rsvp_status || '',
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
      const res = await fetch('http://localhost:5000/api/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile({ ...profile, ...data });
        setEditing(false);
        setMessage('Profile updated!');
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
      const res = await fetch('http://localhost:5000/api/me/rsvp', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        setProfile({ ...profile, rsvp_status: status });
        setMessage('RSVP updated!');
      }
    } catch (err) {
      setMessage('Failed to update RSVP');
    } finally {
      setRsvpSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!profile) {
    return (
      <div className="container">
        <div className="card">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card">
        <img src={logo} alt="USLS Logo" className="logo" />
        <div className="header-row">
          <h1>USLS-IS HS 2003</h1>
          <button onClick={handleLogout} className="btn-link">
            Logout
          </button>
        </div>

        {/* Welcome Section */}
        <div className="welcome-section">
          <h2>🎉 Welcome, {profile.first_name}!</h2>
          <p>Thank you for registering for our <strong>25th Alumni Homecoming</strong>!</p>
          <p>Stay tuned for exciting updates on events, galleries, and more features coming to this site. You can also visit our <a href="https://www.facebook.com/groups/478382298877930" target="_blank" rel="noopener noreferrer">Facebook page</a>!</p>
        </div>

        {message && <p className="success">{message}</p>}

        {/* Profile Section */}
        <div className="profile-section">
          <div className="section-header">
            <h3>Your Information</h3>
            {!editing && (
              <button onClick={() => setEditing(true)} className="btn-secondary">
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <form onSubmit={handleSave}>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name *</label>
                  <input
                    type="text"
                    name="first_name"
                    value={form.first_name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    name="last_name"
                    value={form.last_name}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
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
              </div>

              <div className="form-group">
                <label>Address</label>
                <input
                  type="text"
                  name="address"
                  value={form.address}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>City *</label>
                  <input
                    type="text"
                    name="city"
                    value={form.city}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Country *</label>
                  <input
                    type="text"
                    name="country"
                    value={form.country}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
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
              </div>

              <div className="form-group">
                <label>Are you attending our homecoming on 12/16/28?</label>
                <div className="rsvp-buttons-register">
                  <button
                    type="button"
                    className={`btn-rsvp ${form.rsvp_status === 'going' ? 'active going' : ''}`}
                    onClick={() => setForm({ ...form, rsvp_status: 'going' })}
                  >
                    ✓ Going
                  </button>
                  <button
                    type="button"
                    className={`btn-rsvp ${form.rsvp_status === 'maybe' ? 'active maybe' : ''}`}
                    onClick={() => setForm({ ...form, rsvp_status: 'maybe' })}
                  >
                    ? Maybe
                  </button>
                  <button
                    type="button"
                    className={`btn-rsvp ${form.rsvp_status === 'not_going' ? 'active not-going' : ''}`}
                    onClick={() => setForm({ ...form, rsvp_status: 'not_going' })}
                  >
                    ✗ Not Going
                  </button>
                </div>
              </div>

              <div className="button-row">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="profile-display">
              <p><strong>Email:</strong> {profile.email}</p>
              <p><strong>Name:</strong> {profile.first_name} {profile.last_name}</p>
              {profile.birthday && <p><strong>Birthday:</strong> {new Date(profile.birthday).toLocaleDateString()}</p>}
              {profile.mobile && <p><strong>Mobile:</strong> {profile.mobile}</p>}
              {profile.address && <p><strong>Address:</strong> {profile.address}</p>}
              <p><strong>Location:</strong> {profile.city}, {profile.country}</p>
              {profile.occupation && <p><strong>Occupation:</strong> {profile.occupation}</p>}
              {profile.company && <p><strong>Company:</strong> {profile.company}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}