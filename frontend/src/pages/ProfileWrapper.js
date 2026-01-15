import React from 'react';
import Profile from './Profile';
import ProfileNew from './ProfileNew';

// Feature flag wrapper - switches between old and new profile
export default function ProfileWrapper() {
  const showNewProfile = process.env.REACT_APP_NEW_FEATURES === 'true';

  if (showNewProfile) {
    return <ProfileNew />;
  }

  return <Profile />;
}