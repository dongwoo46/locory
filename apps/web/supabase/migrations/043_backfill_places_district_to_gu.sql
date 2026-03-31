-- Backfill KR place district to administrative gu/gun level.
-- Goal:
-- 1) Keep raw admin columns populated from address where possible.
-- 2) Normalize `places.district` to gu/gun for KR rows.

BEGIN;

-- Existing datasets often omit country_code on KR rows.
UPDATE public.places
SET country_code = 'KR'
WHERE country_code IS NULL;

-- Fill gu_raw from address when missing.
UPDATE public.places
SET gu_raw = COALESCE(
  nullif(trim(gu_raw), ''),
  (regexp_match(address, '([가-힣]+(?:구|군))'))[1]
)
WHERE upper(coalesce(country_code, 'KR')) = 'KR'
  AND address IS NOT NULL
  AND (gu_raw IS NULL OR trim(gu_raw) = '');

-- Fill city_raw / dong_raw too when missing (safe fallback; keeps hierarchy useful).
UPDATE public.places
SET
  city_raw = COALESCE(
    nullif(trim(city_raw), ''),
    (regexp_match(address, '([가-힣]+(?:특별시|광역시|특별자치시|특별자치도|자치시|자치도|시|도))'))[1]
  ),
  dong_raw = COALESCE(
    nullif(trim(dong_raw), ''),
    (regexp_match(address, '([가-힣0-9]+(?:동|읍|면|리|가))'))[1]
  )
WHERE upper(coalesce(country_code, 'KR')) = 'KR'
  AND address IS NOT NULL
  AND (
    city_raw IS NULL OR trim(city_raw) = ''
    OR dong_raw IS NULL OR trim(dong_raw) = ''
  );

-- Normalize district to gu/gun for KR rows.
WITH gu_candidates AS (
  SELECT
    p.id,
    nullif(trim(
      coalesce(
        nullif(trim(p.gu_raw), ''),
        (regexp_match(p.address, '([가-힣]+(?:구|군))'))[1]
      )
    ), '') AS gu_candidate
  FROM public.places p
  WHERE upper(coalesce(p.country_code, 'KR')) = 'KR'
)
UPDATE public.places p
SET district = c.gu_candidate
FROM gu_candidates c
WHERE p.id = c.id
  AND c.gu_candidate IS NOT NULL
  AND (p.district IS DISTINCT FROM c.gu_candidate);

COMMIT;

