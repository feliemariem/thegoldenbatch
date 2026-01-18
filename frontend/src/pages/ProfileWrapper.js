import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Profile from './Profile';
import ProfileNew from './ProfileNew';

// Feature flag wrapper - switches between old and new profile
// Admins are redirected to ProfileNew (/profile-preview)
export default function ProfileWrapper() {
  const { user } = useAuth();
  const showNewProfile = process.env.REACT_APP_NEW_FEATURES === 'true';

  // Redirect admins to the new profile page
  if (user?.isAdmin) {
    return <Navigate to="/profile-preview" replace />;
  }

  if (showNewProfile) {
    return <ProfileNew />;
  }

  return <Profile />;
}