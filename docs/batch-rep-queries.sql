-- Aggregate by position (share with batch)
SELECT position, selection, COUNT(*) as count 
FROM batch_rep_submissions 
GROUP BY position, selection
ORDER BY position, selection;

-- Full details (your eyes only)
SELECT u.first_name, u.last_name, b.position, b.selection, b.nominee_name, b.comments, b.created_at
FROM batch_rep_submissions b
JOIN users u ON u.id = b.voter_id
ORDER BY b.position, b.created_at DESC;

-- Willingness summary
SELECT 
  COUNT(*) FILTER (WHERE willing_aa_rep = true) as aa_rep_willing,
  COUNT(*) FILTER (WHERE willing_aa_rep = false) as aa_rep_not_willing,
  COUNT(*) FILTER (WHERE willing_batch_rep = true) as batch_rep_willing,
  COUNT(*) FILTER (WHERE willing_batch_rep = false) as batch_rep_not_willing
FROM batch_rep_willingness;

-- Willingness full details (your eyes only)
SELECT u.first_name, u.last_name, w.willing_aa_rep, w.willing_batch_rep, w.updated_at
FROM batch_rep_willingness w
JOIN users u ON u.id = w.user_id
ORDER BY w.updated_at DESC;

-- RESET: Clear test submission (single user)
DELETE FROM batch_rep_submissions 
WHERE voter_id = (SELECT id FROM users WHERE email = 'felie@fnrcore.com');

-- RESET: Clear test willingness (single user)
DELETE FROM batch_rep_willingness 
WHERE user_id = (SELECT id FROM users WHERE email = 'felie@fnrcore.com');

-- RESET: Clear ALL test data (testing only)
DELETE FROM batch_rep_submissions;
DELETE FROM batch_rep_willingness;