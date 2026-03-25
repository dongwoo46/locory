-- 029: 현지인 추천 + 향도 재조정 + 번개 trust action 추가
-- Supabase Dashboard → SQL Editor에서 실행하거나 supabase db push

-- 0. place_meetups에 deleted_at 컬럼 추가 (자동 마감 + soft delete 지원)
ALTER TABLE place_meetups
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 0b. 어드민 soft-delete RLS 정책 (이미 존재하면 무시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'place_meetups' AND policyname = 'admin_delete_meetups'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY admin_delete_meetups ON place_meetups
        FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.is_admin = TRUE
          )
        )
    $pol$;
  END IF;
END;
$$;

-- 1. posts 테이블에 is_local_recommendation 컬럼 추가
ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS is_local_recommendation BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. trust_action enum에 새 항목 추가
ALTER TYPE trust_action ADD VALUE IF NOT EXISTS 'local_recommendation_post';
ALTER TYPE trust_action ADD VALUE IF NOT EXISTS 'meetup_created';
ALTER TYPE trust_action ADD VALUE IF NOT EXISTS 'meetup_matched';

-- 3. apply_trust_points 함수 포인트 재조정
--    핵심: frontend calcScentScore 의 log base를 8000 → 500000으로 변경하여
--    진행 속도를 대폭 늦춤. 포인트 자체도 소량으로 재조정.
--    (기존 사용자 trust_score는 유지, 표시 공식만 바꿈)
CREATE OR REPLACE FUNCTION "public"."apply_trust_points"(
  "p_user_id" "uuid",
  "p_action"  "public"."trust_action",
  "p_ref_id"  "uuid" DEFAULT NULL::"uuid"
) RETURNS "void"
  LANGUAGE "plpgsql" SECURITY DEFINER
AS $$
DECLARE
  v_points INTEGER;
BEGIN
  v_points := CASE p_action
    -- 피드 생성
    WHEN 'visited_post'              THEN 1   -- 방문 후기
    WHEN 'want_post'                 THEN 1   -- 가고싶어
    WHEN 'local_recommendation_post' THEN 2   -- 현지인 추천
    WHEN 'hidden_spot_registered'    THEN 2   -- 히든스팟
    -- 반응
    WHEN 'post_saved_by_other'       THEN 1   -- 포스팅 저장됨
    WHEN 'place_saved_by_other'      THEN 1   -- 장소 저장됨
    WHEN 'hidden_spot_reposted'      THEN 1   -- 히든스팟 리포스트
    -- 번개
    WHEN 'meetup_created'            THEN 1   -- 번개 모임 생성
    WHEN 'meetup_matched'            THEN 2   -- 번개 매칭 성사
    -- 보너스/패널티
    WHEN 'daily_bonus'               THEN 1   -- 일일 보너스
    WHEN 'reported'                  THEN -5  -- 신고당함
    WHEN 'fake_place'                THEN -10 -- 가짜 장소
    ELSE 0
  END;

  INSERT INTO trust_logs (user_id, action_type, points, ref_id)
  VALUES (p_user_id, p_action, v_points, p_ref_id);

  UPDATE profiles
  SET trust_score = GREATEST(0, trust_score + v_points)
  WHERE id = p_user_id;
END;
$$;
