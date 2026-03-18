-- =============================================
-- 1. SOFT DELETE: posts, places에 deleted_at 추가
-- =============================================

ALTER TABLE posts  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE places ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- posts SELECT 정책 업데이트 (삭제된 포스트 제외)
DROP POLICY IF EXISTS "공개 포스팅 조회 가능" ON posts;
CREATE POLICY "공개 포스팅 조회 가능" ON posts
  FOR SELECT USING (
    deleted_at IS NULL
    AND (is_public = TRUE OR auth.uid() = user_id)
  );

-- places SELECT 정책 업데이트 (삭제된 장소 제외)
DROP POLICY IF EXISTS "장소 전체 조회 가능" ON places;
CREATE POLICY "장소 전체 조회 가능" ON places
  FOR SELECT USING (deleted_at IS NULL);

-- 어드민은 삭제된 것도 볼 수 있음
CREATE POLICY "어드민 삭제 포스팅 조회" ON posts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "어드민 삭제 장소 조회" ON places
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 2. REPORTS 테이블 (신고)
-- =============================================

CREATE TABLE reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL CHECK (target_type IN ('post', 'place', 'user')),
  target_id    UUID NOT NULL,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
  admin_note   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID REFERENCES profiles(id)
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 신고 내역 조회" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);

CREATE POLICY "로그인 유저 신고 가능" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "어드민 신고 전체 조회" ON reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "어드민 신고 수정 가능" ON reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 3. INQUIRIES 테이블 (문의사항)
-- =============================================

CREATE TABLE inquiries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved')),
  response     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ,
  resolved_by  UUID REFERENCES profiles(id)
);

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 문의 조회" ON inquiries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "로그인 유저 문의 가능" ON inquiries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "어드민 문의 전체 조회" ON inquiries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "어드민 문의 수정 가능" ON inquiries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- =============================================
-- 4. trust_logs 어드민 조회 정책
-- =============================================

CREATE POLICY "어드민 trust 로그 전체 조회" ON trust_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
