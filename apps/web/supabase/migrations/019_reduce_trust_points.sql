-- =============================================
-- 019: trust_score 포인트 조정 (너무 빠른 레벨업 방지)
-- =============================================

CREATE OR REPLACE FUNCTION apply_trust_points(
  p_user_id UUID,
  p_action  trust_action,
  p_ref_id  UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_points INTEGER;
BEGIN
  v_points := CASE p_action
    WHEN 'visited_post'            THEN 2
    WHEN 'want_post'               THEN 1
    WHEN 'hidden_spot_registered'  THEN 8
    WHEN 'post_saved_by_other'     THEN 1
    WHEN 'place_saved_by_other'    THEN 1
    WHEN 'hidden_spot_reposted'    THEN 3
    WHEN 'daily_bonus'             THEN 1
    WHEN 'reported'                THEN -10
    WHEN 'fake_place'              THEN -20
    ELSE 0
  END;

  INSERT INTO trust_logs (user_id, action_type, points, ref_id)
  VALUES (p_user_id, p_action, v_points, p_ref_id);

  UPDATE profiles
  SET trust_score = GREATEST(0, trust_score + v_points)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;