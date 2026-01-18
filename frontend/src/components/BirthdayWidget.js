import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const API_URL = 'https://the-golden-batch-api.onrender.com';

export default function BirthdayWidget() {
  const { token } = useAuth();
  const { theme } = useTheme();
  const [birthdays, setBirthdays] = useState([]);
  const [isHidden, setIsHidden] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [loading, setLoading] = useState(true);

  // Get today's date key for localStorage
  const getTodayKey = () => {
    const today = new Date();
    return `birthday-widget-hidden-${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  };

  // Check localStorage for today's preference
  useEffect(() => {
    const todayKey = getTodayKey();
    const hidden = localStorage.getItem(todayKey);
    if (hidden === 'true') {
      setIsHidden(true);
    }
  }, []);

  // Fetch today's birthdays
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const fetchBirthdays = async () => {
      try {
        const response = await fetch(`${API_URL}/api/me/birthdays/today`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
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
    localStorage.setItem(todayKey, 'true');
    setIsHidden(true);
  };

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  // Don't render if loading, hidden, no birthdays, or not logged in
  if (loading || isHidden || birthdays.length === 0 || !token) {
    return null;
  }

  // Format names for display
  const formatNames = () => {
    if (birthdays.length === 1) {
      return `${birthdays[0].first_name} ${birthdays[0].last_name}`;
    } else if (birthdays.length === 2) {
      return `${birthdays[0].first_name} & ${birthdays[1].first_name}`;
    } else {
      const firstTwo = birthdays.slice(0, 2).map(b => b.first_name).join(', ');
      return `${firstTwo} & ${birthdays.length - 2} more`;
    }
  };

  const isDark = theme === 'dark';

  return (
    <div className={`birthday-widget ${isMinimized ? 'minimized' : ''} ${isDark ? 'dark' : 'light'}`}>
      {isMinimized ? (
        <button
          className="birthday-widget-expand"
          onClick={handleMinimize}
          aria-label="Show birthday widget"
        >
          <span className="birthday-cake-icon">🎂</span>
          <span className="birthday-count">{birthdays.length}</span>
        </button>
      ) : (
        <>
          <div className="birthday-widget-header">
            <button
              className="birthday-widget-minimize"
              onClick={handleMinimize}
              aria-label="Minimize"
              title="Minimize"
            >
              −
            </button>
            <button
              className="birthday-widget-close"
              onClick={handleHide}
              aria-label="Hide for today"
              title="Hide for today"
            >
              ×
            </button>
          </div>
          <div className="birthday-widget-content">
            <div className="birthday-photos">
              {birthdays.slice(0, 3).map((person, index) => (
                <div
                  key={person.id}
                  className="birthday-photo-wrapper"
                  style={{ zIndex: 3 - index }}
                >
                  {person.profile_photo ? (
                    <img
                      src={person.profile_photo}
                      alt={`${person.first_name}'s photo`}
                      className="birthday-photo"
                    />
                  ) : (
                    <div className="birthday-photo-placeholder">
                      {person.first_name.charAt(0)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="birthday-message">
              <span className="birthday-cake-emoji">🎂</span>
              <span className="birthday-text">
                Happy Birthday {formatNames()}!
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
