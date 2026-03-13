import React from 'react';
import uslsSeal from '../images/usls-seal.jpg';

export default function AlumniCardNudge({ profile, alumniCardSaving, onAlumniCard }) {
  if (!profile.section || profile.section === 'Non-Graduate') {
    return null;
  }

  return (
    <div className="profile-card alumni-card-nudge">
      <div className="card-header">
        <h3>🎓 USLS Alumni Card</h3>
      </div>
      {!profile.has_alumni_card ? (
        <div className="alumni-card-row">
          <div className="alumni-card-mini">
            <div className="alumni-card-header">
              <img src={uslsSeal} alt="USLS Seal" className="alumni-card-seal" />
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
              onClick={() => onAlumniCard(true)}
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
            onClick={() => onAlumniCard(false)}
            disabled={alumniCardSaving}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
