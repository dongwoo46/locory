-- wanted_nationalities 컬럼 추가 (016에서 누락된 경우 대비)
ALTER TABLE place_meetups ADD COLUMN IF NOT EXISTS wanted_nationalities TEXT[];

-- 비공개/악취 차단을 위해 RLS 정책 교체
DROP POLICY IF EXISTS "meetups_insert" ON place_meetups;
CREATE POLICY "meetups_insert" ON place_meetups FOR INSERT WITH CHECK (
  auth.uid() = organizer_id AND
  (SELECT is_public FROM profiles WHERE id = auth.uid()) = true AND
  (SELECT trust_score FROM profiles WHERE id = auth.uid()) >= 3
);

DROP POLICY IF EXISTS "joins_insert" ON meetup_joins;
CREATE POLICY "joins_insert" ON meetup_joins FOR INSERT WITH CHECK (
  auth.uid() = applicant_id AND
  (SELECT is_public FROM profiles WHERE id = auth.uid()) = true AND
  (SELECT trust_score FROM profiles WHERE id = auth.uid()) >= 3 AND
  auth.uid() != (SELECT organizer_id FROM place_meetups WHERE id = meetup_id) AND
  (SELECT status FROM place_meetups WHERE id = meetup_id) = 'open' AND
  (SELECT scheduled_at FROM place_meetups WHERE id = meetup_id) > now() AND
  (
    (SELECT wanted_nationalities FROM place_meetups WHERE id = meetup_id) IS NULL OR
    (SELECT nationality::TEXT FROM profiles WHERE id = auth.uid()) = ANY(
      SELECT unnest(wanted_nationalities) FROM place_meetups WHERE id = meetup_id
    )
  )
);

-- 번개 메시지 (스레드)
CREATE TABLE IF NOT EXISTS meetup_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id UUID NOT NULL REFERENCES place_meetups(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) <= 300),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE meetup_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select" ON meetup_messages;
DROP POLICY IF EXISTS "messages_insert" ON meetup_messages;

-- 읽기: 주최자 또는 수락된 참여자
CREATE POLICY "messages_select" ON meetup_messages FOR SELECT USING (
  auth.uid() = (SELECT organizer_id FROM place_meetups WHERE id = meetup_id)
  OR
  auth.uid() IN (
    SELECT applicant_id FROM meetup_joins
    WHERE meetup_id = meetup_messages.meetup_id AND status = 'accepted'
  )
);

-- 쓰기: 주최자 또는 수락된 참여자, 번개 당일(KST)부터 가능
CREATE POLICY "messages_insert" ON meetup_messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND
  (
    auth.uid() = (SELECT organizer_id FROM place_meetups WHERE id = meetup_id)
    OR
    auth.uid() IN (
      SELECT applicant_id FROM meetup_joins
      WHERE meetup_id = meetup_messages.meetup_id AND status = 'accepted'
    )
  ) AND
  -- 번개 당일(KST 기준) 0시부터 오픈
  DATE(
    (SELECT scheduled_at FROM place_meetups WHERE id = meetup_id)
    AT TIME ZONE 'Asia/Seoul'
  ) <= DATE(now() AT TIME ZONE 'Asia/Seoul')
);
