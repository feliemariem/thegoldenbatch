// Soft-launch access list. These graduates get full site access ahead of the
// full batch rollout, without being admins. They never see the Admin tab or
// committee-internal cards (those gate on admin flags, not this list).
export const SOFT_LAUNCH_EMAILS = [
  'felie@fnrcore.com',
  // add the ~15 soft-launch emails here, lowercase
];

export const isSoftLaunch = (user) => {
  if (!user) return false;
  return SOFT_LAUNCH_EMAILS.includes(user.email?.toLowerCase());
};
