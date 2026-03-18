-- =============================================
-- ENUMS
-- =============================================

CREATE TYPE nationality AS ENUM ('KR', 'JP', 'US', 'CN', 'ES', 'RU', 'OTHER');
CREATE TYPE city AS ENUM ('seoul', 'busan', 'jeju', 'gyeongju', 'jeonju');
CREATE TYPE category AS ENUM ('cafe', 'restaurant', 'photospot', 'street', 'bar', 'culture', 'nature', 'shopping');
CREATE TYPE place_type AS ENUM ('normal', 'hidden_spot');
CREATE TYPE post_type AS ENUM ('visited', 'want');
CREATE TYPE rating AS ENUM ('must_go', 'worth_it', 'neutral', 'not_great', 'never');
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE trust_action AS ENUM (
  'visited_post',
  'want_post',
  'hidden_spot_registered',
  'post_saved_by_other',
  'place_saved_by_other',
  'hidden_spot_reposted',
  'daily_bonus',
  'reported',
  'fake_place'
);

-- =============================================
-- PROFILES
-- =============================================

CREATE TABLE profiles (
  id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname     TEXT NOT NULL,
  nationality  nationality NOT NULL DEFAULT 'KR',
  avatar_url   TEXT,
  is_public    BOOLEAN NOT NULL DEFAULT TRUE,
  trust_score  INTEGER NOT NULL DEFAULT 1,
  role         user_role NOT NULL DEFAULT 'user',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "공개 프로필 조회 가능" ON profiles
  FOR SELECT USING (is_public = TRUE OR auth.uid() = id);

CREATE POLICY "본인 프로필만 수정 가능" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "본인 프로필 생성 가능" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- =============================================
-- PLACES
-- =============================================

CREATE TABLE places (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  address     TEXT,
  city        city NOT NULL,
  category    category NOT NULL,
  place_type  place_type NOT NULL DEFAULT 'normal',
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "장소 전체 조회 가능" ON places
  FOR SELECT USING (TRUE);

CREATE POLICY "로그인 유저 장소 등록 가능" ON places
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "본인이 등록한 장소만 수정 가능" ON places
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "어드민 장소 수정 가능" ON places
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "어드민 장소 삭제 가능" ON places
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- POSTS
-- =============================================

CREATE TABLE posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  place_id    UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  type        post_type NOT NULL,
  rating      rating,
  memo        TEXT,
  photos      TEXT[] NOT NULL DEFAULT '{}',
  is_public   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT visited_requires_rating CHECK (
    type != 'visited' OR rating IS NOT NULL
  )
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "공개 포스팅 조회 가능" ON posts
  FOR SELECT USING (
    is_public = TRUE
    OR auth.uid() = user_id
  );

CREATE POLICY "로그인 유저 포스팅 생성 가능" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 포스팅만 수정 가능" ON posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "본인 포스팅만 삭제 가능" ON posts
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- PLACE SAVES (북마크)
-- =============================================

CREATE TABLE place_saves (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  place_id    UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, place_id)
);

ALTER TABLE place_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 장소 저장 조회" ON place_saves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 장소 저장 생성" ON place_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 장소 저장 삭제" ON place_saves
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- POST SAVES (북마크)
-- =============================================

CREATE TABLE post_saves (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id     UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, post_id)
);

ALTER TABLE post_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 포스팅 저장 조회" ON post_saves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "본인 포스팅 저장 생성" ON post_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "본인 포스팅 저장 삭제" ON post_saves
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- TRUST LOGS
-- =============================================

CREATE TABLE trust_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action_type  trust_action NOT NULL,
  points       INTEGER NOT NULL,
  ref_id       UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE trust_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 trust 로그 조회" ON trust_logs
  FOR SELECT USING (auth.uid() = user_id);

-- =============================================
-- FUNCTION: trust_score 자동 업데이트
-- =============================================

CREATE OR REPLACE FUNCTION apply_trust_points(
  p_user_id UUID,
  p_action  trust_action,
  p_ref_id  UUID DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_points INTEGER;
BEGIN
  v_points := CASE p_action
    WHEN 'visited_post'            THEN 5
    WHEN 'want_post'               THEN 3
    WHEN 'hidden_spot_registered'  THEN 15
    WHEN 'post_saved_by_other'     THEN 2
    WHEN 'place_saved_by_other'    THEN 2
    WHEN 'hidden_spot_reposted'    THEN 5
    WHEN 'daily_bonus'             THEN 1
    WHEN 'reported'                THEN -10
    WHEN 'fake_place'              THEN -20
    ELSE 0
  END;

  INSERT INTO trust_logs (user_id, action_type, points, ref_id)
  VALUES (p_user_id, p_action, v_points, p_ref_id);

  UPDATE profiles
  SET trust_score = GREATEST(0, trust_score + v_points)
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- FUNCTION: 신규 유저 프로필 자동 생성
-- =============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role user_role;
BEGIN
  v_role := CASE NEW.email
    WHEN 'siwol406@gmail.com' THEN 'admin'::user_role
    ELSE 'user'::user_role
  END;

  INSERT INTO public.profiles (id, nickname, nationality, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, '여행자'),
    'KR'::nationality,
    NEW.raw_user_meta_data->>'avatar_url',
    v_role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- STORAGE: posts 버킷 정책
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('posts', 'posts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "누구나 이미지 조회 가능" ON storage.objects
  FOR SELECT USING (bucket_id = 'posts');

CREATE POLICY "로그인 유저 이미지 업로드" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'posts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "본인 이미지만 삭제" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'posts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
