-- Aggregate only (share with batch)
SELECT selection, COUNT(*) as count 
FROM batch_rep_submissions 
GROUP BY selection;

-- Full details (your eyes only)
SELECT u.first_name, u.last_name, b.selection, b.nominee_name, b.comments, b.created_at
FROM batch_rep_submissions b
JOIN users u ON u.id = b.voter_id
ORDER BY b.created_at DESC;

-- RESET: Clear a test submission (use during testing only)
DELETE FROM batch_rep_submissions 
WHERE voter_id = (SELECT id FROM users WHERE email = 'felie@fnrcore.com');