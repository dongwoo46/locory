-- =============================================
-- 009: birth_year 보정 + nickname 제약
-- =============================================

-- birth_year (002에서 누락된 경우 보정)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_year SMALLINT;

-- nickname UNIQUE 제약 (중복 닉네임이 있으면 suffix 붙여서 먼저 해소)
DO $$
DECLARE
  r RECORD;
  new_nick TEXT;
  counter INT;
BEGIN
  FOR r IN
    SELECT id, nickname FROM profiles
    WHERE id::text NOT IN (
      SELECT MIN(id::text) FROM profiles GROUP BY nickname
    )
  LOOP
    counter := 1;
    new_nick := substring(r.nickname, 1, 12) || counter::TEXT;
    WHILE EXISTS (SELECT 1 FROM profiles WHERE nickname = new_nick AND id != r.id) LOOP
      counter := counter + 1;
      new_nick := substring(r.nickname, 1, 12) || counter::TEXT;
    END LOOP;
    UPDATE profiles SET nickname = new_nick WHERE id = r.id;
  END LOOP;
END$$;

ALTER TABLE profiles ADD CONSTRAINT profiles_nickname_unique UNIQUE (nickname);

-- 신규/수정 닉네임만 영어 강제 (NOT VALID = 기존 데이터는 검사 안 함)
ALTER TABLE profiles ADD CONSTRAINT profiles_nickname_format
  CHECK (nickname ~ '^[a-zA-Z0-9][a-zA-Z0-9._-]{1,15}$') NOT VALID;

-- handle_new_user: 중복 없는 닉네임 자동 생성 (언어 제한 없음)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role      user_role;
  v_nickname  TEXT;
  v_base      TEXT;
  v_counter   INT := 0;
BEGIN
  v_role := CASE NEW.email
    WHEN 'siwol406@gmail.com' THEN 'admin'::user_role
    ELSE 'user'::user_role
  END;

  -- full_name 사용, 없으면 이메일 앞부분
  v_base := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(NEW.email, '@', 1)
  );
  v_base := substring(v_base, 1, 14);

  -- 중복 없는 닉네임 생성
  v_nickname := v_base;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE nickname = v_nickname) LOOP
    v_counter := v_counter + 1;
    v_nickname := substring(v_base, 1, 12) || v_counter::TEXT;
  END LOOP;

  INSERT INTO public.profiles (id, nickname, nationality, avatar_url, role)
  VALUES (
    NEW.id,
    v_nickname,
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
