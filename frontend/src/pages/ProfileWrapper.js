import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Profile from './Profile';

// Feature flag wrapper - switches between old and new profile
// Routing logic:
// - Super Admin → ProfileNew
// - Admin with non-registry permissions → ProfileNew
// - Registry Admin (only registry perms) → Profile
// - Regular user → Profile
export default function ProfileWrapper() {
  const { user } = useAuth();

  if (process.env.NODE_ENV !== 'production') {
    console.log('ProfileWrapper debug:', {
      isAdmin: user?.isAdmin,
      is_super_admin: user?.is_super_admin,
      hasNonRegistryPermissions: user?.hasNonRegistryPermissions,
      hasPermissions: user?.hasPermissions,
      fullUser: user
    });
  }

  // Super admins and admins with non-registry permissions go to ProfileNew
  const goesToNewProfile = user?.is_super_admin || (user?.isAdmin && user?.hasNonRegistryPermissions);

  if (goesToNewProfile) {
    return <Navigate to="/profile-preview" replace />;
  }

  return <Profile />;
}