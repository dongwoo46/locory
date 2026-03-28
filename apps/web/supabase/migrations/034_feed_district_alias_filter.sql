-- Consolidated migration (was 034~039)
-- Includes:
-- 1) places global/raw location columns + indexes
-- 2) neighborhood_mappings table + resolver function
-- 3) feed RPC update for global city/neighborhood filters
-- 4) seed mapping rules
-- 5) backfill existing places

-- 1) places columns/indexes
ALTER TABLE public.places
  ADD COLUMN IF NOT EXISTS city_raw text,
  ADD COLUMN IF NOT EXISTS gu_raw text,
  ADD COLUMN IF NOT EXISTS dong_raw text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS city_global text,
  ADD COLUMN IF NOT EXISTS neighborhood_global text,
  ADD COLUMN IF NOT EXISTS postal_code_raw text;

CREATE INDEX IF NOT EXISTS idx_places_country_city_global
  ON public.places (country_code, city_global);

CREATE INDEX IF NOT EXISTS idx_places_city_neighborhood_global
  ON public.places (city_global, neighborhood_global);

-- 2) neighborhood mapping table + resolver function
CREATE TABLE IF NOT EXISTS public.neighborhood_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text NOT NULL,
  city_key text,
  neighborhood_code text NOT NULL,
  neighborhood_label text NOT NULL,
  match_type text NOT NULL CHECK (match_type IN ('sublocality', 'locality', 'admin2', 'postal_prefix', 'keyword')),
  match_value text NOT NULL,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_neighborhood_mappings_country_city
  ON public.neighborhood_mappings (country_code, city_key, is_active, priority);

CREATE INDEX IF NOT EXISTS idx_neighborhood_mappings_match
  ON public.neighborhood_mappings (country_code, match_type, match_value);

ALTER TABLE public.neighborhood_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS neighborhood_mappings_read_policy ON public.neighborhood_mappings;
CREATE POLICY neighborhood_mappings_read_policy
  ON public.neighborhood_mappings
  FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.resolve_place_neighborhood(
  p_country_code text,
  p_city_key text DEFAULT NULL,
  p_city_fallback text DEFAULT NULL,
  p_admin_area_level_2 text DEFAULT NULL,
  p_locality text DEFAULT NULL,
  p_sublocality text DEFAULT NULL,
  p_postal_code text DEFAULT NULL,
  p_neighborhood_fallback text DEFAULT NULL
)
RETURNS TABLE (
  city_global text,
  neighborhood_global text,
  neighborhood_code text,
  matched_rule_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_country text := upper(coalesce(nullif(trim(p_country_code), ''), 'KR'));
  v_city_key text := nullif(trim(p_city_key), '');
  v_city_fallback text := nullif(trim(p_city_fallback), '');
  v_admin2 text := nullif(trim(p_admin_area_level_2), '');
  v_locality text := nullif(trim(p_locality), '');
  v_sublocality text := nullif(trim(p_sublocality), '');
  v_postal text := nullif(trim(p_postal_code), '');
  v_neighborhood_fallback text := nullif(trim(p_neighborhood_fallback), '');
  v_city_for_match text;
  v_rule public.neighborhood_mappings%ROWTYPE;
BEGIN
  v_city_for_match := coalesce(v_city_key, v_city_fallback, v_locality, v_admin2);

  SELECT r.*
  INTO v_rule
  FROM public.neighborhood_mappings r
  WHERE r.is_active = true
    AND upper(r.country_code) = v_country
    AND (r.city_key IS NULL OR lower(r.city_key) = lower(coalesce(v_city_for_match, '')))
    AND (
      (r.match_type = 'sublocality' AND v_sublocality IS NOT NULL AND lower(v_sublocality) LIKE '%' || lower(r.match_value) || '%')
      OR (r.match_type = 'locality' AND v_locality IS NOT NULL AND lower(v_locality) LIKE '%' || lower(r.match_value) || '%')
      OR (r.match_type = 'admin2' AND v_admin2 IS NOT NULL AND lower(v_admin2) LIKE '%' || lower(r.match_value) || '%')
      OR (r.match_type = 'postal_prefix' AND v_postal IS NOT NULL AND v_postal LIKE r.match_value || '%')
      OR (r.match_type = 'keyword' AND (
            (v_sublocality IS NOT NULL AND lower(v_sublocality) LIKE '%' || lower(r.match_value) || '%')
         OR (v_locality IS NOT NULL AND lower(v_locality) LIKE '%' || lower(r.match_value) || '%')
         OR (v_admin2 IS NOT NULL AND lower(v_admin2) LIKE '%' || lower(r.match_value) || '%')
      ))
    )
  ORDER BY r.priority ASC, r.created_at ASC
  LIMIT 1;

  city_global := coalesce(v_rule.city_key, v_city_for_match);
  neighborhood_global := coalesce(v_rule.neighborhood_label, v_neighborhood_fallback);
  neighborhood_code := coalesce(v_rule.neighborhood_code, v_neighborhood_fallback);
  matched_rule_id := v_rule.id;

  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_place_neighborhood(
  text, text, text, text, text, text, text, text
) TO authenticated;

-- 3) feed RPC global city/neighborhood filter
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
    pl.country_code AS place_country_code,
    pl.city_global AS place_city_global,
    pl.neighborhood_global AS place_neighborhood_global,
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
    AND (
      p_city IS NULL
      OR lower(coalesce(nullif(pl.city_global, ''), pl.city::text)) = lower(p_city)
    )
    AND (
      p_district IS NULL
      OR (
        p_district <> '__other__'
        AND (
          lower(coalesce(nullif(pl.neighborhood_global, ''), coalesce(pl.district, ''))) = lower(p_district)
          OR lower(coalesce(pl.district, '')) IN (
            SELECT lower(x) FROM unnest(p_known_districts) AS x
          )
        )
      )
      OR (
        p_district = '__other__'
        AND (
          coalesce(nullif(pl.neighborhood_global, ''), pl.district) IS NULL
          OR lower(coalesce(nullif(pl.neighborhood_global, ''), coalesce(pl.district, ''))) NOT IN (
            SELECT lower(x) FROM unnest(p_known_districts) AS x
          )
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
          'place_type', place_type,
          'country_code', place_country_code,
          'city_global', place_city_global,
          'neighborhood_global', place_neighborhood_global
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

-- 4) seed mapping rules
INSERT INTO public.neighborhood_mappings (country_code, city_key, neighborhood_code, neighborhood_label, match_type, match_value, priority)
VALUES
  ('KR', 'seoul', 'hongdae', '홍대', 'sublocality', '서교', 10),
  ('KR', 'seoul', 'hongdae', '홍대', 'keyword', '홍대', 10),
  ('KR', 'seoul', 'hongdae', '홍대', 'admin2', '마포구', 30),
  ('KR', 'seoul', 'seongsu', '성수', 'sublocality', '성수', 10),
  ('KR', 'seoul', 'seongsu', '성수', 'admin2', '성동구', 30),
  ('KR', 'seoul', 'gangnam', '강남', 'admin2', '강남구', 30),
  ('KR', 'seoul', 'jamsil', '잠실', 'admin2', '송파구', 30),
  ('KR', 'seoul', 'itaewon', '이태원', 'admin2', '용산구', 30),
  ('KR', 'busan', 'haeundae', '해운대', 'admin2', '해운대구', 30),
  ('KR', 'busan', 'gwangalli', '광안리', 'admin2', '수영구', 30),
  ('KR', 'busan', 'seomyeon', '서면', 'admin2', '부산진구', 30),
  ('JP', NULL, 'shibuya', 'Shibuya', 'locality', 'Shibuya', 20),
  ('JP', NULL, 'shinjuku', 'Shinjuku', 'locality', 'Shinjuku', 20),
  ('US', NULL, 'manhattan', 'Manhattan', 'locality', 'Manhattan', 20),
  ('US', NULL, 'brooklyn', 'Brooklyn', 'locality', 'Brooklyn', 20)
ON CONFLICT DO NOTHING;

-- 5) backfill existing places
UPDATE public.places
SET
  city_raw = COALESCE(city_raw, (regexp_match(address, '([가-힣]+(?:특별시|광역시|특별자치시|특별자치도|자치시|자치도|시|도))'))[1]),
  gu_raw = COALESCE(gu_raw, (regexp_match(address, '([가-힣]+(?:구|군))'))[1]),
  dong_raw = COALESCE(dong_raw, (regexp_match(address, '([가-힣0-9]+(?:동|읍|면|리|가))'))[1])
WHERE address IS NOT NULL
  AND (city_raw IS NULL OR gu_raw IS NULL OR dong_raw IS NULL);

UPDATE public.places
SET country_code = 'KR'
WHERE country_code IS NULL;

WITH base AS (
  SELECT
    p.id,
    upper(coalesce(nullif(trim(p.country_code), ''), 'KR')) AS country_code,
    p.city::text AS city_key,
    coalesce(
      nullif(trim(p.city_global), ''),
      nullif(trim(p.city_raw), ''),
      p.city::text
    ) AS city_fallback,
    coalesce(
      nullif(trim(p.neighborhood_global), ''),
      nullif(trim(p.dong_raw), ''),
      nullif(trim(p.gu_raw), ''),
      nullif(trim(p.district), '')
    ) AS neighborhood_fallback,
    nullif(trim(p.gu_raw), '') AS admin_area_level_2,
    nullif(trim(p.city_raw), '') AS locality,
    nullif(trim(p.dong_raw), '') AS sublocality,
    nullif(trim(p.postal_code_raw), '') AS postal_code
  FROM public.places p
),
resolved AS (
  SELECT
    b.id,
    r.city_global AS resolved_city_global,
    r.neighborhood_global AS resolved_neighborhood_global,
    r.neighborhood_code AS resolved_neighborhood_code
  FROM base b
  LEFT JOIN LATERAL public.resolve_place_neighborhood(
    b.country_code,
    b.city_key,
    b.city_fallback,
    b.admin_area_level_2,
    b.locality,
    b.sublocality,
    b.postal_code,
    b.neighborhood_fallback
  ) r ON true
)
UPDATE public.places p
SET
  city_global = COALESCE(p.city_global, resolved.resolved_city_global, base.city_fallback),
  neighborhood_global = COALESCE(p.neighborhood_global, resolved.resolved_neighborhood_global, base.neighborhood_fallback),
  district = CASE
    WHEN base.country_code = 'KR'
      AND resolved.resolved_neighborhood_code IS NOT NULL
      AND (
        p.district IS NULL
        OR p.district = 'other'
        OR p.district ~ '구$'
      )
    THEN resolved.resolved_neighborhood_code
    ELSE p.district
  END
FROM base
JOIN resolved ON resolved.id = base.id
WHERE p.id = base.id
  AND (
    p.city_global IS NULL
    OR p.neighborhood_global IS NULL
    OR (
      base.country_code = 'KR'
      AND resolved.resolved_neighborhood_code IS NOT NULL
      AND (
        p.district IS NULL
        OR p.district = 'other'
        OR p.district ~ '구$'
      )
    )
  );
