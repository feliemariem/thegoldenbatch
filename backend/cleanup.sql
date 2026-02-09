-- ============================================================
-- CLEAN SLATE FOR TESTING (before public release)
-- ============================================================
-- Wipes all test data while keeping:
-- ✅ master_list names (clears registration/invite data)
-- ✅ ledger (donation records)
-- ✅ meeting_minutes, meeting_attachments, action_items
-- ✅ Super Admin (id=1) and their permissions
-- ❌ Everything else gets deleted
-- ============================================================

DELETE FROM action_items;
DELETE FROM announcement_reads;
DELETE FROM messages;
DELETE FROM volunteer_interests;
DELETE FROM permissions WHERE admin_id != 1;
DELETE FROM password_resets;
DELETE FROM announcements;
DELETE FROM rsvps;
DELETE FROM event_rsvps;
DELETE FROM events;
DELETE FROM users;
DELETE FROM invites;
DELETE FROM admins WHERE id != 1;

-- Reset Master List (keep names, clear registration/invite data)
UPDATE master_list SET
  email = NULL,
  current_name = NULL,
  status = 'Not Invited',
  is_admin = FALSE,
  is_unreachable = FALSE
WHERE id > 0;

-- Cleanup duplicate permissions (if any exist)
DELETE FROM permissions a USING permissions b
WHERE a.id < b.id AND a.admin_id = b.admin_id;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Should only show admin_id=1 with count=1
SELECT 'Permissions check:' as check;
SELECT admin_id, COUNT(*) FROM permissions GROUP BY admin_id;

-- Should only show id=1
SELECT 'Admins check:' as check;
SELECT id, email FROM admins;

-- Should all show 'Not Invited', NULL emails and current_name
SELECT 'Master list check (first 10):' as check;
SELECT id, first_name, last_name, status, email, current_name, is_admin FROM master_list LIMIT 10;

-- Should be 0
SELECT 'Invites count (should be 0):' as check;
SELECT COUNT(*) FROM invites;

-- Should be 0
SELECT 'Users count (should be 0):' as check;
SELECT COUNT(*) FROM users;

-- Should be 0
SELECT 'Announcements count (should be 0):' as check;
SELECT COUNT(*) FROM announcements;

-- Should still have your data
SELECT 'Ledger count (should have data):' as check;
SELECT COUNT(*) FROM ledger;

-- Should still have your data
SELECT 'Meeting minutes count (should have data):' as check;
SELECT COUNT(*) FROM meeting_minutes;