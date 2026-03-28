-- Existing DB reconciliation + backfill
-- Use this when older environments already ran migration 034 before consolidation.

-- 1) Ensure required place columns exist
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

-- 2) Ensure neighborhood mapping assets exist
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

-- In case older environments already contain duplicated manual seed rows,
-- deduplicate first so unique index creation does not fail.
WITH ranked AS (
  SELECT
    ctid,
    row_number() OVER (
      PARTITION BY
        country_code,
        coalesce(city_key, ''),
        neighborhood_code,
        neighborhood_label,
        match_type,
        match_value
      ORDER BY created_at ASC, ctid ASC
    ) AS rn
  FROM public.neighborhood_mappings
)
DELETE FROM public.neighborhood_mappings nm
USING ranked r
WHERE nm.ctid = r.ctid
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_neighborhood_mappings_rule
  ON public.neighborhood_mappings (
    country_code,
    coalesce(city_key, ''),
    neighborhood_code,
    neighborhood_label,
    match_type,
    match_value
  );

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

-- 3) Seed baseline mapping rules
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

-- 4) Backfill raw columns from address where missing
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

-- 5) Resolve and write city_global / neighborhood_global and KR district alias code
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

