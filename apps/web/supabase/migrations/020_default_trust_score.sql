-- =============================================
-- 020: 신규 가입 기본 trust_score = 4 (무취 15%)
-- =============================================

-- 테이블 기본값 변경
ALTER TABLE profiles ALTER COLUMN trust_score SET DEFAULT 4;

-- handle_new_user에서 trust_score 명시적으로 지정 + Google locale → nationality 자동 매핑
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role        user_role;
  v_nickname    TEXT;
  v_base        TEXT;
  v_counter     INT := 0;
  v_locale      TEXT;
  v_nationality nationality;
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

  -- Google locale → nationality 매핑
  v_locale := lower(coalesce(NEW.raw_user_meta_data->>'locale', ''));
  v_nationality := CASE
    WHEN v_locale LIKE 'ko%'               THEN 'KR'::nationality
    WHEN v_locale LIKE 'ja%'               THEN 'JP'::nationality
    WHEN v_locale IN ('zh-tw', 'zh-hant')  THEN 'OTHER'::nationality
    WHEN v_locale LIKE 'zh%'               THEN 'CN'::nationality
    WHEN v_locale LIKE 'es%'               THEN 'ES'::nationality
    WHEN v_locale LIKE 'ru%'               THEN 'RU'::nationality
    WHEN v_locale LIKE 'en%'               THEN 'US'::nationality
    ELSE                                        'OTHER'::nationality
  END;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    INSERT INTO public.profiles (id, nickname, nationality, avatar_url, role, trust_score)
    VALUES (
      NEW.id,
      v_nickname,
      v_nationality,
      NEW.raw_user_meta_data->>'avatar_url',
      v_role,
      4  -- 무취 15%에서 시작
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
