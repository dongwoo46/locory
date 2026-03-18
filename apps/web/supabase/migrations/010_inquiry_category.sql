-- inquiries에 category 컬럼 추가
ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other'
  CHECK (category IN ('bug', 'account', 'content', 'points', 'suggestion', 'other'));

-- profiles_nickname_format CHECK 제약 제거
-- 언어 제한 없이 2~16자, 욕설 필터는 프론트엔드에서만
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_nickname_format;
DROP TRIGGER IF EXISTS trg_validate_nickname ON profiles;
DROP FUNCTION IF EXISTS validate_nickname_on_change();
