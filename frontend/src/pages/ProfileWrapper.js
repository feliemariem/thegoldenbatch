import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Profile from './Profile';
import ProfileNew from './ProfileNew';

// Feature flag wrapper - switches between old and new profile
// Routing logic:
// - Admin with non-registry permissions → ProfileNew
// - Registry Admin (only registry perms) → old Profile
// - Super Admin → old Profile
// - Regular user → Profile (or ProfileNew if feature flag enabled)
export default function ProfileWrapper() {
  const { user } = useAuth();
  const showNewProfile = process.env.REACT_APP_NEW_FEATURES === 'true';

  // Redirect admins with non-registry permissions to ProfileNew (not super admins)
  if (user?.isAdmin && !user?.is_super_admin && user?.hasNonRegistryPermissions) {
    return <Navigate to="/profile-preview" replace />;
  }

  if (showNewProfile) {
    return <ProfileNew />;
  }

  return <Profile />;
}