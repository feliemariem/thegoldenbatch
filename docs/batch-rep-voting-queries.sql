-- ============================================================
-- BATCH REP ROUND 2 VOTING QUERIES
-- ============================================================

-- View all votes
SELECT u.first_name, u.last_name, v.position, v.candidate_name, v.created_at
FROM batch_rep_round2_votes v
JOIN users u ON u.id = v.voter_id
ORDER BY v.created_at ASC;

-- Tally by candidate
SELECT candidate_name, COUNT(*) as votes
FROM batch_rep_round2_votes
WHERE position = 1
GROUP BY candidate_name
ORDER BY votes DESC;

-- RESET: Clear test vote (user id 71)
DELETE FROM batch_rep_round2_votes WHERE voter_id = 71;

-- RESET: Clear ALL Round 2 votes (testing only)
DELETE FROM batch_rep_round2_votes;