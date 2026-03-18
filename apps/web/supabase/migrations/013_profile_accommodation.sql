-- 프로필에 숙소 정보 저장 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS accommodation_name TEXT,
  ADD COLUMN IF NOT EXISTS accommodation_address TEXT;
