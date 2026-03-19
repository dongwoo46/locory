-- 유저 인터랙션 데이터를 1번 쿼리로 반환하는 RPC
-- post_saves, place_saves, post_likes, place_likes → 4개 쿼리 → 1개로 통합
CREATE OR REPLACE FUNCTION get_user_interactions(p_user_id UUID)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'savedPostIds',  COALESCE((SELECT json_agg(post_id)   FROM post_saves  WHERE user_id = p_user_id), '[]'::json),
    'savedPlaceIds', COALESCE((SELECT json_agg(place_id)  FROM place_saves WHERE user_id = p_user_id), '[]'::json),
    'likedPostIds',  COALESCE((SELECT json_agg(post_id)   FROM post_likes  WHERE user_id = p_user_id), '[]'::json),
    'likedPlaceIds', COALESCE((SELECT json_agg(place_id)  FROM place_likes WHERE user_id = p_user_id), '[]'::json)
  )
$$;

GRANT EXECUTE ON FUNCTION get_user_interactions(UUID) TO authenticated;