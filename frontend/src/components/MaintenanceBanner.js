import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';

/**
 * MaintenanceBanner - Displays a site-wide maintenance notification
 *
 * Props:
 * - scheduledTime: ISO string with timezone offset (e.g. '2026-04-07T09:00:00-07:00')
 * - durationMinutes: number (e.g. 5)
 */
export default function MaintenanceBanner({ scheduledTime, durationMinutes }) {
  const { theme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(true);
  const [isVisible, setIsVisible] = useState(true);

  // Calculate end time and check visibility
  useEffect(() => {
    const checkVisibility = () => {
      const scheduled = new Date(scheduledTime);
      const endTime = new Date(scheduled.getTime() + durationMinutes * 60 * 1000);
      const now = new Date();

      if (now >= endTime) {
        setIsVisible(false);
      }
    };

    checkVisibility();
    // Check every minute
    const interval = setInterval(checkVisibility, 60000);
    return () => clearInterval(interval);
  }, [scheduledTime, durationMinutes]);

  if (!isVisible) {
    return null;
  }

  // Format the scheduled time in user's local timezone
  const formatLocalTime = (isoString) => {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    }).format(date);
  };

  const formattedTime = formatLocalTime(scheduledTime);
  const isDark = theme === 'dark';

  const bannerStyles = {
    width: '100%',
    background: isDark ? '#CFB53B' : '#006633',
    color: isDark ? '#1a1a1a' : '#ffffff',
    textAlign: 'center',
    fontSize: '0.85rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  };

  const expandedStyles = {
    ...bannerStyles,
    padding: '10px 16px'
  };

  const collapsedStyles = {
    ...bannerStyles,
    padding: '6px 16px',
    fontSize: '0.75rem'
  };

  const chevronStyles = {
    marginLeft: '8px',
    display: 'inline-block',
    transition: 'transform 0.2s ease',
    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
  };

  return (
    <div
      style={isExpanded ? expandedStyles : collapsedStyles}
      onClick={() => setIsExpanded(!isExpanded)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          setIsExpanded(!isExpanded);
        }
      }}
    >
      {isExpanded ? (
        <span>
          Scheduled maintenance on {formattedTime} · The site will be unavailable for up to {durationMinutes} minutes.
          <span style={chevronStyles}>▲</span>
        </span>
      ) : (
        <span>
          Scheduled maintenance · tap to expand
          <span style={chevronStyles}>▼</span>
        </span>
      )}
    </div>
  );
}
