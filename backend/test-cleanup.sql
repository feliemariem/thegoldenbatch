-- Test Account Cleanup Script
-- Replace 'test@email.com' with the actual test email used

-- 1. Remove RSVPs
DELETE FROM rsvps WHERE user_id = (SELECT id FROM users WHERE email = 'test@email.com');

-- 2. Remove receipts
DELETE FROM receipt_uploads WHERE user_id = (SELECT id FROM users WHERE email = 'test@email.com');

-- 3. Revert master list entry
UPDATE master_list SET 
  status = 'Not Invited', 
  email = NULL, 
  current_name = NULL, 
  is_admin = false, 
  builder_tier = NULL, 
  pledge_amount = NULL, 
  builder_tier_set_at = NULL 
WHERE email = 'test@email.com';

-- 4. Delete user
DELETE FROM users WHERE email = 'test@email.com';

-- 5. Delete invite
DELETE FROM invites WHERE email = 'test@email.com';