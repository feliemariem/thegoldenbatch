import React, { useState, useRef } from 'react';
import { FaFacebook, FaLinkedin, FaInstagram } from 'react-icons/fa';
import { apiPut, apiUpload, apiDelete } from '../api';
import { formatBirthday } from '../utils/profileUtils';

export default function InfoCard({ profile, user, onSaved, onPhotoChange, onMessage, onOpenMerchModal }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await apiPut('/api/me', form);

      if (res.ok) {
        const data = await res.json();
        onSaved(data);
        setEditing(false);
        onMessage('Profile updated!');
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
                onClick={onOpenMerchModal}
              >
                {profile.shirt_size || profile.jacket_size ? 'Edit Sizes' : 'Set Sizes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
