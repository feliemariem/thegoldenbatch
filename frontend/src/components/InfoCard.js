import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { FaFacebook, FaLinkedin, FaInstagram } from 'react-icons/fa';
import { apiPut, apiPost, apiUpload, apiDelete } from '../api';
import { formatBirthday } from '../utils/profileUtils';

// Default visibility settings
const defaultVisibility = { location: true, occupation: false, company: false, social: false };

export default function InfoCard({ profile, user, onSaved, onPhotoChange, onMessage, onOpenMerchModal }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    first_name: profile.first_name || '',
    last_name: profile.last_name || '',
    birthday: profile.birthday ? profile.birthday.split('T')[0] : '',
    mobile: profile.mobile || '',
    address: profile.address || '',
    city: profile.city || '',
    country: profile.country || '',
    occupation: profile.occupation || '',
    company: profile.company || '',
    facebook_url: profile.facebook_url || '',
    linkedin_url: profile.linkedin_url || '',
    instagram_url: profile.instagram_url || '',
  });

  const [visibility, setVisibility] = useState(profile.visibility || defaultVisibility);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Check if name has changed
      const nameChanged = form.first_name !== profile.first_name || form.last_name !== profile.last_name;

      // Save visibility settings
      await apiPut('/api/me/visibility', { visibility });

      if (nameChanged) {
        // Submit name change request separately
        await apiPost('/api/name-change-requests', {
          requested_first_name: form.first_name,
          requested_last_name: form.last_name
        });

        // Strip name fields from the form and save other fields
        const { first_name, last_name, ...otherFields } = form;
        const res = await apiPut('/api/me', otherFields);

        if (res.ok) {
          const data = await res.json();
          onSaved({ ...data, visibility });
          onMessage('Your name change is pending review by the admin. Other changes have been saved.');
          setTimeout(() => setEditing(false), 3000);
        }
      } else {
        // No name change, save normally
        const res = await apiPut('/api/me', form);

        if (res.ok) {
          const data = await res.json();
          onSaved({ ...data, visibility });
          onMessage('Profile updated!');
          setTimeout(() => setEditing(false), 3000);
        }
      }
    } catch (err) {
      onMessage('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      onMessage('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      onMessage('Image must be less than 5MB');
      return;
    }

    setUploadingPhoto(true);
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const res = await apiUpload('/api/me/photo', formData);

      if (res.ok) {
        const data = await res.json();
        onPhotoChange(data.profile_photo);
        onMessage('Photo uploaded!');
      } else {
        onMessage('Failed to upload photo');
      }
    } catch (err) {
      onMessage('Failed to upload photo');
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
        onPhotoChange(null);
        onMessage('Photo removed');
      }
    } catch (err) {
      onMessage('Failed to remove photo');
    }
  };

  const showSectionLink = profile.section && profile.section !== 'Non-Graduate';

  // Social icons component - always show all 3 (faded if no URL)
  const socialIcons = (
    <div className="info-social-row">
      <div className="social-icons-row">
        {profile.facebook_url ? (
          <a
            href={`https://facebook.com/${profile.facebook_url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon-link facebook"
            title="Facebook"
          >
            <FaFacebook />
          </a>
        ) : (
          <span className="social-icon-link facebook faded" title="Facebook not set">
            <FaFacebook />
          </span>
        )}
        {profile.linkedin_url ? (
          <a
            href={`https://linkedin.com/in/${profile.linkedin_url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon-link linkedin"
            title="LinkedIn"
          >
            <FaLinkedin />
          </a>
        ) : (
          <span className="social-icon-link linkedin faded" title="LinkedIn not set">
            <FaLinkedin />
          </span>
        )}
        {profile.instagram_url ? (
          <a
            href={`https://instagram.com/${profile.instagram_url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="social-icon-link instagram"
            title="Instagram"
          >
            <FaInstagram />
          </a>
        ) : (
          <span className="social-icon-link instagram faded" title="Instagram not set">
            <FaInstagram />
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="profile-card info-card">
      <div className="card-header">
        <h3>Your Information</h3>
        {!editing && (
          <button onClick={() => setEditing(true)} className="btn-edit">
            Edit
          </button>
        )}
      </div>

      {/* Hidden file input */}
      <input
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        ref={fileInputRef}
        style={{ display: 'none' }}
        id="photo-upload"
      />

      {/* Compact header row with avatar and name */}
      <div className="info-header-row">
        <div className="info-avatar-wrapper">
          <div className="info-avatar">
            {profile.profile_photo ? (
              <img
                src={profile.profile_photo}
                alt={`${profile.first_name}'s photo`}
              />
            ) : (
              <div className="info-avatar-initials">
                {profile.first_name?.charAt(0)}{profile.last_name?.charAt(0)}
              </div>
            )}
          </div>
          <button
            type="button"
            className="avatar-edit-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            title={uploadingPhoto ? 'Uploading...' : 'Change photo'}
          >
            ✎
          </button>
        </div>
        <div className="info-name-section">
          <h2>{profile.first_name} {profile.last_name}</h2>
          {showSectionLink && (
            <Link
              to={`/directory?section=${encodeURIComponent(profile.section)}`}
              className="section-classmates-link"
            >
              {profile.section} · See your classmates →
            </Link>
          )}
        </div>
      </div>

      {/* Social icons - always visible */}
      {socialIcons}

      {editing ? (
        <form onSubmit={handleSave} className="edit-form">
          {/* Remove photo button - only in edit mode */}
          {profile.profile_photo && (
            <div style={{ marginBottom: '16px' }}>
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="btn-photo-remove"
              >
                Remove Photo
              </button>
            </div>
          )}

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

          {/* Directory Visibility Section */}
          <div className="visibility-section">
            <label className="visibility-section-label">Directory Visibility</label>
            <p className="visibility-description">Choose what information appears in the batch directory.</p>
            <div className="visibility-toggles">
              <label className="visibility-toggle">
                <input
                  type="checkbox"
                  checked={visibility.location}
                  onChange={(e) => setVisibility({ ...visibility, location: e.target.checked })}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">Show location (city, country)</span>
              </label>
              <label className="visibility-toggle">
                <input
                  type="checkbox"
                  checked={visibility.occupation}
                  onChange={(e) => setVisibility({ ...visibility, occupation: e.target.checked })}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">Show occupation</span>
              </label>
              <label className="visibility-toggle">
                <input
                  type="checkbox"
                  checked={visibility.company}
                  onChange={(e) => setVisibility({ ...visibility, company: e.target.checked })}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">Show company</span>
              </label>
              <label className="visibility-toggle">
                <input
                  type="checkbox"
                  checked={visibility.social}
                  onChange={(e) => setVisibility({ ...visibility, social: e.target.checked })}
                />
                <span className="toggle-slider"></span>
                <span className="toggle-label">Show social media links</span>
              </label>
            </div>
          </div>

          {/* Name change warning - above save buttons */}
          <div className="name-change-warning" style={{ marginTop: '16px', marginBottom: '16px' }}>
            Note: Name changes require admin approval. Use of fake names or profanity will result in your submission being rejected.
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
          {/* Collapsible details toggle */}
          <button
            type="button"
            className="info-collapse-toggle"
            onClick={() => setDetailsOpen(!detailsOpen)}
          >
            <span>{detailsOpen ? 'Hide details' : 'View details'}</span>
            <span className={`info-collapse-arrow ${detailsOpen ? 'open' : ''}`}>▼</span>
          </button>

          {/* Collapsible content */}
          <div className={`info-collapsible ${detailsOpen ? 'open' : ''}`}>
            <div className="info-collapsible-content">
              <div className="info-grid">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
