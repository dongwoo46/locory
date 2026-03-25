ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS photo_variants jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.posts AS p
SET photo_variants = COALESCE(
  (
    SELECT jsonb_agg(
      jsonb_build_object(
        'thumbnailUrl', url,
        'mediumUrl', url,
        'originalUrl', url
      )
      ORDER BY ord
    )
    FROM unnest(p.photos) WITH ORDINALITY AS t(url, ord)
  ),
  '[]'::jsonb
)
WHERE p.photo_variants = '[]'::jsonb
  AND cardinality(p.photos) > 0;
