import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { apiGet } from '../api';

export default function BirthdayWidget() {
  const { token, user } = useAuth();
  const { theme } = useTheme();
  const [birthdays, setBirthdays] = useState([]);
  const [isHidden, setIsHidden] = useState(false);
  const [loading, setLoading] = useState(true);

  // Get today's date key for localStorage (per-user)
  const getTodayKey = () => {
    if (!user?.id) return null;
    const today = new Date();
    return `birthday-widget-hidden-${user.id}-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  };

  // Check localStorage for today's preference
  useEffect(() => {
    const todayKey = getTodayKey();
    if (!todayKey) return;
    const hidden = localStorage.getItem(todayKey);
    if (hidden === 'true') {
      setIsHidden(true);
    }
  }, [user]);

  // Fetch today's birthdays
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchBirthdays = async () => {
      try {
        const response = await apiGet('/api/me/birthdays/today');
        if (response.ok) {
          const data = await response.json();
          setBirthdays(data);
        }
      } catch (err) {
        console.error('Failed to fetch birthdays:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBirthdays();
  }, [token]);

  const handleHide = () => {
    const todayKey = getTodayKey();
    if (todayKey) {
      localStorage.setItem(todayKey, 'true');
    }
    setIsHidden(true);
  };

  // Don't render if loading, hidden, no birthdays, or not logged in
  if (loading || isHidden || birthdays.length === 0 || !token) {
    return null;
  }

  const isDark = theme === 'dark';

  return (
    <div className={`birthday-banner ${isDark ? 'dark' : 'light'}`}>
      <div className="birthday-banner-content">
        <div className="birthday-banner-photos">
          {birthdays.slice(0, 3).map((person, index) => (
            <div
              key={person.id}
              className="birthday-banner-photo-wrapper"
              style={{ zIndex: 3 - index }}
            >
              {person.profile_photo ? (
                <img
                  src={person.profile_photo}
                  alt={`${person.first_name}'s photo`}
                  className="birthday-banner-photo"
                />
              ) : (
                <div className="birthday-banner-photo-placeholder">
                  {person.first_name.charAt(0)}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="birthday-banner-message">
          <span className="birthday-banner-emoji">🎂</span>
          <span className="birthday-banner-text">
            Happy Birthday {birthdays.map((b, i) => {
              if (i === 0) return `${b.first_name} ${b.last_name}`;
              if (i === birthdays.length - 1) return ` & ${b.first_name} ${b.last_name}`;
              return `, ${b.first_name} ${b.last_name}`;
            }).join('')}!
          </span>
        </div>
      </div>
      <button
        className="birthday-banner-close"
        onClick={handleHide}
        aria-label="Hide for today"
        title="Hide for today"
      >
        ×
      </button>
    </div>
  );
}
