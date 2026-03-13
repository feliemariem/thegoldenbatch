// Access control phases for batch-rep feature:
// Phase 1: Only felie@fnrcore.com
// Phase 2: All admins
// Phase 3: All registered graduates
export const BATCH_REP_PHASE = 1;

export const allowedEmails = [
  'felie@fnrcore.com',
  'emvjanklow@gmail.com',
  'nqa.attynea@gmail.com',
  'jmrnv07@gmail.com',
  'chayamalonso@gmail.com',
  'eckkee03@gmail.com',
  'coycoy.cordova@gmail.com',
  'johannajison@gmail.com',
  'pngolez@gmail.com',
  'narcisojavelosa@yahoo.com',
  'willkramer27@gmail.com'
];

// Batch-rep deadline: March 21, 2026 at 11:59 PM PHT (UTC+8)
export const BATCH_REP_DEADLINE = new Date('2026-03-21T23:59:00+08:00');

// Check if user has access based on current phase
export const checkPhaseAccess = (user, isGrad) => {
  if (!user) return false;

  const userEmail = user.email?.toLowerCase();

  switch (BATCH_REP_PHASE) {
    case 1:
      // Phase 1: Only specific emails
      return allowedEmails.includes(userEmail);
    case 2:
      return user.isAdmin === true;
    case 3:
      return isGrad === true;
    default:
      return false;
  }
};

export const isDeadlinePassed = () => {
  return new Date() > BATCH_REP_DEADLINE;
};

export const getDaysUntilBatchRepDeadline = () => {
  const now = new Date();
  const diffTime = BATCH_REP_DEADLINE - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};
