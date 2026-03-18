-- follows 테이블에 status 컬럼 추가 (공개 계정: accepted, 비공개 계정: pending → accepted)
ALTER TABLE follows ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'accepted'
  CHECK (status IN ('pending', 'accepted'));

-- pending 상태 팔로우 요청 조회 정책 (팔로우 받는 사람도 볼 수 있어야 함)
DROP POLICY IF EXISTS "팔로우 조회" ON follows;

CREATE POLICY "팔로우 조회" ON follows
  FOR SELECT USING (
    auth.uid() = follower_id OR auth.uid() = following_id
  );
