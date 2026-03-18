-- places: 구글 평점 및 place_id 저장
ALTER TABLE places
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS google_rating   NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS google_review_count INT;

-- posts: 메뉴 추천 필드
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS recommended_menu TEXT;
