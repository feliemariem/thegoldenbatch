import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Profile from './Profile';
import ProfileNew from './ProfileNew';

// Feature flag wrapper - switches between old and new profile
// Admins are redirected to ProfileNew (/profile-preview), except Registry Admins
export default function ProfileWrapper() {
  const { user } = useAuth();
  const showNewProfile = process.env.REACT_APP_NEW_FEATURES === 'true';

  // Registry Admin: admin with no super admin status and no permissions
  const isRegistryAdmin = user?.isAdmin && !user?.is_super_admin && !user?.hasPermissions;

  // Redirect admins to the new profile page (except Registry Admins)
  if (user?.isAdmin && !isRegistryAdmin) {
    return <Navigate to="/profile-preview" replace />;
  }

  if (showNewProfile) {
    return <ProfileNew />;
  }

  return <Profile />;
}