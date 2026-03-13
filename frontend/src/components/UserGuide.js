import React from 'react';

export default function UserGuide({ profile }) {
  return (
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
  );
}
