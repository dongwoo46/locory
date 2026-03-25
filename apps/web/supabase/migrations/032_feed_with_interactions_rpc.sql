CREATE OR REPLACE FUNCTION get_feed_with_interactions(
  p_user_id uuid,
  p_feed_tab text DEFAULT 'all',
  p_following_ids uuid[] DEFAULT '{}'::uuid[],
  p_city text DEFAULT NULL,
  p_district text DEFAULT NULL,
  p_known_districts text[] DEFAULT '{}'::text[],
  p_limit integer DEFAULT 15,
  p_cursor_created_at timestamptz DEFAULT NULL,
  p_cursor_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
WITH feed_rows AS (
  SELECT
    p.id,
    p.type,
    p.rating,
    p.memo,
    p.photos,
    p.photo_variants,
    p.recommended_menu,
    p.created_at,
    p.user_id,
    p.is_public,
    p.is_local_recommendation,
    pr.id AS profile_id,
    pr.nickname,
    pr.nationality,
    pr.avatar_url,
    pr.trust_score,
    pr.gender,
    pr.birth_date,
    pl.id AS place_id,
    pl.name AS place_name,
    pl.category AS place_category,
    pl.district AS place_district,
    pl.city AS place_city,
    pl.place_type,
    (SELECT count(*) FROM post_likes l WHERE l.post_id = p.id) AS post_likes_count,
    (SELECT count(*) FROM post_saves s WHERE s.post_id = p.id) AS post_saves_count
  FROM posts p
  JOIN profiles pr ON pr.id = p.user_id
  JOIN places pl ON pl.id = p.place_id
  WHERE p.is_public = true
    AND p.deleted_at IS NULL
    AND (
      p_feed_tab <> 'following'
      OR p.user_id = ANY(p_following_ids)
    )
    AND (p_city IS NULL OR pl.city::text = p_city)
    AND (
      p_district IS NULL
      OR (p_district <> '__other__' AND pl.district = p_district)
      OR (
        p_district = '__other__'
        AND (
          pl.district IS NULL
          OR pl.district <> ALL(p_known_districts)
        )
      )
    )
    AND (
      p_cursor_created_at IS NULL
      OR p.created_at < p_cursor_created_at
      OR (p.created_at = p_cursor_created_at AND p.id < p_cursor_id)
    )
  ORDER BY p.created_at DESC, p.id DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50)
),
feed_json AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'type', type,
        'rating', rating,
        'memo', memo,
        'photos', photos,
        'photo_variants', photo_variants,
        'recommended_menu', recommended_menu,
        'created_at', created_at,
        'user_id', user_id,
        'is_public', is_public,
        'is_local_recommendation', is_local_recommendation,
        'profiles', jsonb_build_object(
          'id', profile_id,
          'nickname', nickname,
          'nationality', nationality,
          'avatar_url', avatar_url,
          'trust_score', trust_score,
          'gender', gender,
          'birth_date', birth_date
        ),
        'places', jsonb_build_object(
          'id', place_id,
          'name', place_name,
          'category', place_category,
          'district', place_district,
          'city', place_city,
          'place_type', place_type
        ),
        'post_likes', jsonb_build_array(jsonb_build_object('count', post_likes_count)),
        'post_saves', jsonb_build_array(jsonb_build_object('count', post_saves_count))
      )
      ORDER BY created_at DESC, id DESC
    ),
    '[]'::jsonb
  ) AS posts
  FROM feed_rows
),
interactions AS (
  SELECT jsonb_build_object(
    'savedPostIds',  COALESCE((SELECT jsonb_agg(post_id) FROM post_saves WHERE user_id = p_user_id), '[]'::jsonb),
    'savedPlaceIds', COALESCE((SELECT jsonb_agg(place_id) FROM place_saves WHERE user_id = p_user_id), '[]'::jsonb),
    'likedPostIds',  COALESCE((SELECT jsonb_agg(post_id) FROM post_likes WHERE user_id = p_user_id), '[]'::jsonb),
    'likedPlaceIds', COALESCE((SELECT jsonb_agg(place_id) FROM place_likes WHERE user_id = p_user_id), '[]'::jsonb)
  ) AS data
)
SELECT jsonb_build_object(
  'posts', feed_json.posts,
  'interactions', interactions.data
)
FROM feed_json, interactions;
$$;

GRANT EXECUTE ON FUNCTION get_feed_with_interactions(
  uuid, text, uuid[], text, text, text[], integer, timestamptz, uuid
) TO authenticated;
