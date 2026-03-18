-- birth_date 컬럼 추가 (birth_year 대체), 성별 변경 추적, 자기소개
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS birth_date DATE,
  ADD COLUMN IF NOT EXISTS gender_changed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bio TEXT CHECK (char_length(bio) <= 120);

-- 기존 birth_year 데이터를 birth_date로 마이그레이션 (1월 1일로 변환)
UPDATE profiles
  SET birth_date = make_date(birth_year, 1, 1)
  WHERE birth_year IS NOT NULL AND birth_date IS NULL;
