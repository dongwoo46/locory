-- ── meetup_chat_reads ─────────────────────────────────────────────────────────
-- 채팅에서 각 유저가 마지막으로 읽은 시간 추적 (읽음 확인용)
CREATE TABLE IF NOT EXISTS meetup_chat_reads (
  meetup_id    uuid NOT NULL REFERENCES place_meetups(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meetup_id, user_id)
);

ALTER TABLE meetup_chat_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mcr_own" ON meetup_chat_reads
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── blocks ───────────────────────────────────────────────────────────────────
-- 사용자 차단 테이블
CREATE TABLE IF NOT EXISTS blocks (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocks_select" ON blocks FOR SELECT USING (blocker_id = auth.uid());
CREATE POLICY "blocks_insert" ON blocks FOR INSERT WITH CHECK (blocker_id = auth.uid());
CREATE POLICY "blocks_delete" ON blocks FOR DELETE USING (blocker_id = auth.uid());
