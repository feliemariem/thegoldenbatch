// frontend/src/config/softLaunchConfig.js
//
// Soft-launch access list. These graduates get full site access ahead of the
// full batch rollout, without being admins. They never see the Admin tab or
// committee-internal cards (those gate on admin flags, not this list).

// Master switch. false = nobody in the list has access (use during the
// presentation). true = the list is live.
export const SOFT_LAUNCH_ENABLED = false;

export const SOFT_LAUNCH_EMAILS = [
  'leonardo.francisco.73@gmail.com',
  'anne.diamante16@gmail.com',
  'jpdyrodriguez@gmail.com',
  'nescy.mendoza@gmail.com',
  'katrinasolinap@gmail.com',
  'robbierivero@hotmail.com',
  'adriantapialianne@gmail.com',
  'bombtrax2001@gmail.com',
  'minniepacigado@gmail.com',
  'rachel_justiniani@yahoo.com',
  'francosebastian.ramos@gmail.com',
  'janineballesteros1985@gmail.com',
  'christerisulat@gmail.com',
];

export const isSoftLaunch = (user) => {
  if (!SOFT_LAUNCH_ENABLED) return false;
  if (!user) return false;
  return SOFT_LAUNCH_EMAILS.includes(user.email?.toLowerCase());
};
