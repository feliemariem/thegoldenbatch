-- Test Account Cleanup Script
-- Angel (Non-Graduate Test Account)

-- 1. Remove RSVPs
DELETE FROM rsvps WHERE user_id = (SELECT id FROM users WHERE email = 'angel@example.com');

-- 2. Remove receipts
DELETE FROM receipt_uploads WHERE user_id = (SELECT id FROM users WHERE email = 'angel@example.com');

-- 3. Remove permissions (if they were made admin)
DELETE FROM permissions WHERE admin_id = (SELECT id FROM admins WHERE email = 'angel@example.com');

-- 4. Remove admin entry (non-super only)
DELETE FROM admins WHERE email = 'angel@example.com' AND is_super_admin = false;

-- 5. Revert master list entry
UPDATE master_list SET 
  status = 'Not Invited', 
  email = NULL, 
  current_name = NULL, 
  is_admin = false, 
  builder_tier = NULL, 
  pledge_amount = NULL, 
  builder_tier_set_at = NULL 
WHERE email = 'angel@example.com';

-- 6. Delete user
DELETE FROM users WHERE email = 'angel@example.com';

-- 7. Delete invite
DELETE FROM invites WHERE email = 'angel@example.com';