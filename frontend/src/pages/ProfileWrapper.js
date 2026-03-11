import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Profile from './Profile';
import ProfileNew from './ProfileNew';

// Feature flag wrapper - switches between old and new profile
// Admins are redirected to ProfileNew (/profile-preview), except Registry Admins and Super Admins
export default function ProfileWrapper() {
  const { user } = useAuth();
  const showNewProfile = process.env.REACT_APP_NEW_FEATURES === 'true';

  // Registry Admin: admin with no super admin status and only registry permissions
  const isRegistryAdmin = user?.isAdmin && !user?.is_super_admin && !user?.hasNonRegistryPermissions;

  // Redirect admins with non-registry permissions to ProfileNew (not super admins, not registry admins)
  if (user?.isAdmin && !user?.is_super_admin && user?.hasNonRegistryPermissions) {
    return <Navigate to="/profile-preview" replace />;
  }

  if (showNewProfile) {
    return <ProfileNew />;
  }

  return <Profile />;
}