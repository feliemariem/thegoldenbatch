import React from 'react';
import { getDaysUntilBatchRepDeadline } from '../config/batchRepConfig';
import '../styles/batchrep.css';

export default function BatchRepModal({ show, profile, batchRepHasSubmitted, onDismiss, onNavigate }) {
  if (!show) return null;

  return (
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
                onClick={onNavigate}
              >
                Update My Response →
              </button>
              <button
                className="batchrep-modal-dismiss"
                onClick={onDismiss}
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
                    <div className="batchrep-modal-nominee-label">Nominee · Alumni Assoc. Representative</div>
                    <div className="batchrep-modal-nominee-name">Bianca Jison</div>
                  </div>
                </div>
                <div className="batchrep-modal-nominee">
                  <div className="batchrep-modal-nominee-avatar initials">FM</div>
                  <div className="batchrep-modal-nominee-info">
                    <div className="batchrep-modal-nominee-label">Nominee · Batch Representative</div>
                    <div className="batchrep-modal-nominee-name">Felie Magbanua</div>
                  </div>
                </div>
              </div>
              <div className="batchrep-modal-deadline">
                🕐 Feedback window closes <span className="deadline-date">March 21, 2026 at 11:59 PM PHT</span>
                {getDaysUntilBatchRepDeadline() > 0 && (
                  <span className="deadline-countdown"> · {getDaysUntilBatchRepDeadline()} day{getDaysUntilBatchRepDeadline() !== 1 ? 's' : ''} left</span>
                )}
              </div>
              <button
                className="batchrep-modal-btn"
                onClick={onNavigate}
              >
                Submit My Response →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
