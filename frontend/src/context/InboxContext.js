import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { apiGet } from '../api';

const InboxContext = createContext(null);

export function InboxProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    try {
      // Fetch both announcements and messages in parallel
      const [announcementsRes, messagesRes] = await Promise.all([
        apiGet('/api/announcements/inbox'),
        apiGet('/api/messages/user-inbox'),
      ]);

      let count = 0;

      if (announcementsRes.ok) {
        const announcementsData = await announcementsRes.json();
        const announcements = announcementsData.announcements || [];
        count += announcements.filter(a => !a.is_read).length;
      }

      if (messagesRes.ok) {
        const messagesData = await messagesRes.json();
        const messages = messagesData.messages || [];
        count += messages.filter(m => !m.is_read).length;
      }

      setUnreadCount(count);
    } catch (err) {
      console.error('Failed to fetch unread count');
    }
  }, [user]);

  // Fetch unread count on mount and when token changes
  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  // Function to decrement unread count when an item is marked as read
  const decrementUnreadCount = () => {
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  // Function to refresh the unread count
  const refreshUnreadCount = () => {
    fetchUnreadCount();
  };

  return (
    <InboxContext.Provider value={{ unreadCount, decrementUnreadCount, refreshUnreadCount }}>
      {children}
    </InboxContext.Provider>
  );
}

export function useInbox() {
  const context = useContext(InboxContext);
  if (!context) {
    throw new Error('useInbox must be used within InboxProvider');
  }
  return context;
}
