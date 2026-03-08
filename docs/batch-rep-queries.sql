-- Aggregate only (share with batch)
SELECT selection, COUNT(*) as count 
FROM batch_rep_submissions 
GROUP BY selection;

-- Full details (your eyes only)
SELECT u.first_name, u.last_name, b.selection, b.nominee_name, b.nominee_master_list_id, b.comments, b.created_at
FROM batch_rep_submissions b
JOIN users u ON u.id = b.voter_id
ORDER BY b.created_at DESC;

-- Willingness summary
SELECT willing, COUNT(*) as count
FROM batch_rep_willingness
GROUP BY willing;

-- Willingness full details (your eyes only)
SELECT u.first_name, u.last_name, w.willing, w.updated_at
FROM batch_rep_willingness w
JOIN users u ON u.id = w.user_id
ORDER BY w.updated_at DESC;

-- RESET: Clear test submission
DELETE FROM batch_rep_submissions 
WHERE voter_id = (SELECT id FROM users WHERE email = 'felie@fnrcore.com');

-- RESET: Clear test willingness
DELETE FROM batch_rep_willingness 
WHERE user_id = (SELECT id FROM users WHERE email = 'felie@fnrcore.com');

-- RESET: Clear ALL test data (testing only)
DELETE FROM batch_rep_submissions;
DELETE FROM batch_rep_willingness;