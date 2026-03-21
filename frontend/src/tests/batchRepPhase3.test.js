// Test the Phase 3 version of checkPhaseAccess
// BATCH_REP_PHASE is set to 3 here to simulate rollout conditions
const BATCH_REP_PHASE = 3;

const checkPhaseAccess = (user, isGrad) => {
  if (!user) return false;
  const userEmail = user.email?.toLowerCase();

  switch (BATCH_REP_PHASE) {
    case 1:
      const allowedEmails = ['felie@fnrcore.com'];
      return allowedEmails.includes(userEmail);
    case 2:
      return user.isAdmin === true && user.hasNonRegistryPermissions === true;
    case 3:
      return isGrad === true;
    default:
      return false;
  }
};

// Simulate hasAccess line from both BatchRepVoting.js and BatchRepVotingModal.js
// Phase 3: user?.id === 71 condition MUST be removed
// This is what hasAccess should look like in Phase 3:
const hasAccessPhase3 = (user, isGrad) => checkPhaseAccess(user, isGrad);
// NOT: checkPhaseAccess(user, isGrad) && user?.id === 71

describe('Phase 3 access control — graduates only', () => {

  // GRAD CASES — should pass
  test('registered graduate passes', () => {
    const user = { id: 99, email: 'grad@example.com', isAdmin: false };
    expect(hasAccessPhase3(user, true)).toBe(true);
  });

  test('registered graduate who is also an admin passes', () => {
    const user = { id: 85, email: 'bianca@example.com', isAdmin: true, hasNonRegistryPermissions: true };
    expect(hasAccessPhase3(user, true)).toBe(true);
  });

  test('felie (user id 71) passes as a graduate', () => {
    const user = { id: 71, email: 'felie@fnrcore.com', isAdmin: true };
    expect(hasAccessPhase3(user, true)).toBe(true);
  });

  // NON-GRAD CASES — should fail (the bleed scenario)
  test('non-graduate registrant is blocked (isGrad false)', () => {
    // This is the bleed case — registered but section is NULL or Non-Graduate
    const user = { id: 200, email: 'nongrad@example.com', isAdmin: false };
    expect(hasAccessPhase3(user, false)).toBe(false);
  });

  test('non-graduate with no section is blocked', () => {
    const user = { id: 201, email: 'friend@example.com', isAdmin: false };
    expect(hasAccessPhase3(user, false)).toBe(false);
  });

  test('registry-only admin who is not a grad is blocked', () => {
    const user = { id: 50, email: 'registryadmin@example.com', isAdmin: true, hasNonRegistryPermissions: false };
    expect(hasAccessPhase3(user, false)).toBe(false);
  });

  // NULL/UNDEFINED CASES — should fail
  test('null user is blocked', () => {
    expect(hasAccessPhase3(null, true)).toBe(false);
  });

  test('undefined user is blocked', () => {
    expect(hasAccessPhase3(undefined, true)).toBe(false);
  });

  test('grad with null isGrad value is blocked', () => {
    // isGrad null means backend hasn't confirmed — must not pass
    const user = { id: 99, email: 'grad@example.com' };
    expect(hasAccessPhase3(user, null)).toBe(false);
  });

  // PHASE 3 SPECIFIC — user.id === 71 guard must NOT be present
  test('user.id === 71 guard is not required in Phase 3', () => {
    // In Phase 3, a graduate with id !== 71 must pass without needing id === 71
    const user = { id: 150, email: 'batchmate@example.com' };
    expect(hasAccessPhase3(user, true)).toBe(true);
  });

  test('user.id === 71 guard would incorrectly block valid graduates if still applied', () => {
    // This test documents the bug that would occur if && user?.id === 71 was left in
    const user = { id: 150, email: 'batchmate@example.com' };
    const hasAccessWithBadGuard = (user, isGrad) =>
      checkPhaseAccess(user, isGrad) && user?.id === 71;
    // This SHOULD fail — proving the guard must be removed for Phase 3
    expect(hasAccessWithBadGuard(user, true)).toBe(false);
  });
});
