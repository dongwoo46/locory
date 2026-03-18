-- =============================================
-- 002: onboarded 컬럼, 팔로우, post_likes, city enum 확장
-- =============================================

-- profiles: onboarded 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS onboarded BOOLEAN NOT NULL DEFAULT FALSE;

-- profiles: birth_year 추가 (나이 필터링용)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_year SMALLINT;

-- 기존 유저 중 닉네임이 설정된 사람은 onboarded 처리 (선택사항)
-- UPDATE profiles SET onboarded = TRUE WHERE nickname IS NOT NULL AND nickname != '';

-- =============================================
-- CITY ENUM 확장 (이미 추가됐다면 skip)
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'jeonju' AND enumtypid = 'city'::regtype) THEN
    ALTER TYPE city ADD VALUE 'jeonju';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'gangneung' AND enumtypid = 'city'::regtype) THEN
    ALTER TYPE city ADD VALUE 'gangneung';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sokcho' AND enumtypid = 'city'::regtype) THEN
    ALTER TYPE city ADD VALUE 'sokcho';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'yeosu' AND enumtypid = 'city'::regtype) THEN
    ALTER TYPE city ADD VALUE 'yeosu';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'incheon' AND enumtypid = 'city'::regtype) THEN
    ALTER TYPE city ADD VALUE 'incheon';
  END IF;
END$$;

-- =============================================
-- district 컬럼 추가 (places)
-- =============================================

ALTER TABLE places ADD COLUMN IF NOT EXISTS district TEXT;

-- =============================================
-- POST LIKES
-- =============================================

CREATE TABLE IF NOT EXISTS post_likes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "좋아요 조회 가능" ON post_likes
  FOR SELECT USING (TRUE);

CREATE POLICY "본인 좋아요 생성" ON post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 좋아요 삭제" ON post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- FOLLOWS (팔로우/팔로워)
-- =============================================

CREATE TABLE IF NOT EXISTS follows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follower_id, following_id),
  CHECK (follower_id != following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "팔로우 조회 가능" ON follows
  FOR SELECT USING (TRUE);

CREATE POLICY "본인 팔로우 생성" ON follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "본인 팔로우 삭제" ON follows
  FOR DELETE USING (auth.uid() = follower_id);

-- =============================================
-- STORAGE: avatars 버킷
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "아바타 이미지 조회 가능" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "로그인 유저 아바타 업로드" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "본인 아바타 업데이트" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "본인 아바타 삭제" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
