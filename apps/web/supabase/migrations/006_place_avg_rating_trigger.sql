-- places: 평균 평점 컬럼 추가
ALTER TABLE places ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2);

-- 기존 데이터 초기화 (이미 있는 포스트 기반으로 계산)
UPDATE places p SET avg_rating = (
  SELECT AVG(CASE rating
    WHEN 'must_go'  THEN 4
    WHEN 'worth_it' THEN 3
    WHEN 'neutral'  THEN 2
    WHEN 'not_great' THEN 1
  END)
  FROM posts
  WHERE place_id = p.id
    AND type = 'visited'
    AND rating IS NOT NULL
);

-- 트리거 함수
CREATE OR REPLACE FUNCTION update_place_avg_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_place_id UUID;
BEGIN
  target_place_id := COALESCE(NEW.place_id, OLD.place_id);

  UPDATE places SET avg_rating = (
    SELECT AVG(CASE rating
      WHEN 'must_go'  THEN 4
      WHEN 'worth_it' THEN 3
      WHEN 'neutral'  THEN 2
      WHEN 'not_great' THEN 1
    END)
    FROM posts
    WHERE place_id = target_place_id
      AND type = 'visited'
      AND rating IS NOT NULL
  )
  WHERE id = target_place_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 연결 (포스트 insert/update/delete 시 자동 실행)
DROP TRIGGER IF EXISTS trg_update_avg_rating ON posts;
CREATE TRIGGER trg_update_avg_rating
  AFTER INSERT OR UPDATE OR DELETE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_place_avg_rating();
