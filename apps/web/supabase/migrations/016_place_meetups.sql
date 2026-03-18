-- 번개 게시글
CREATE TABLE IF NOT EXISTS place_meetups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  scheduled_at TIMESTAMPTZ NOT NULL,

  -- 주최자 측 정보
  host_count     INT NOT NULL DEFAULT 1,
  host_gender    TEXT CHECK (host_gender IN ('male', 'female', 'mixed')),
  host_age_groups TEXT[] NOT NULL DEFAULT '{}',
  activities     TEXT[] NOT NULL DEFAULT '{}',
  vibe           TEXT CHECK (vibe IN ('casual', 'fun', 'serious')),
  description    TEXT CHECK (char_length(description) <= 100),

  -- 원하는 상대 조건 (null = 무관)
  wanted_gender       TEXT CHECK (wanted_gender IN ('male', 'female', 'any')),
  wanted_age_groups   TEXT[],
  wanted_count        INT,
  wanted_nationalities TEXT[],

  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'expired')),

  created_at TIMESTAMPTZ DEFAULT now()
);

-- 테이블이 이미 존재할 경우 누락된 컬럼 추가 (idempotent)
ALTER TABLE place_meetups ADD COLUMN IF NOT EXISTS wanted_nationalities TEXT[];

-- 참여 신청
CREATE TABLE IF NOT EXISTS meetup_joins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id    UUID NOT NULL REFERENCES place_meetups(id) ON DELETE CASCADE,
  applicant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  join_count      INT NOT NULL DEFAULT 1,
  join_gender     TEXT CHECK (join_gender IN ('male', 'female', 'mixed')),
  join_age_groups TEXT[] NOT NULL DEFAULT '{}',
  message         TEXT CHECK (char_length(message) <= 80),

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'unmatched')),
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (meetup_id, applicant_id)
);

ALTER TABLE place_meetups ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetup_joins ENABLE ROW LEVEL SECURITY;

-- place_meetups RLS (idempotent)
DROP POLICY IF EXISTS "meetups_select" ON place_meetups;
DROP POLICY IF EXISTS "meetups_insert" ON place_meetups;
DROP POLICY IF EXISTS "meetups_update" ON place_meetups;
DROP POLICY IF EXISTS "meetups_delete" ON place_meetups;

CREATE POLICY "meetups_select" ON place_meetups FOR SELECT USING (true);
CREATE POLICY "meetups_insert" ON place_meetups FOR INSERT WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "meetups_update" ON place_meetups FOR UPDATE USING (auth.uid() = organizer_id);
CREATE POLICY "meetups_delete" ON place_meetups FOR DELETE USING (auth.uid() = organizer_id);

-- meetup_joins RLS (idempotent)
DROP POLICY IF EXISTS "joins_select" ON meetup_joins;
DROP POLICY IF EXISTS "joins_insert" ON meetup_joins;
DROP POLICY IF EXISTS "joins_update" ON meetup_joins;
DROP POLICY IF EXISTS "joins_delete" ON meetup_joins;

CREATE POLICY "joins_select" ON meetup_joins FOR SELECT USING (
  auth.uid() = applicant_id OR
  auth.uid() = (SELECT organizer_id FROM place_meetups WHERE id = meetup_id)
);
CREATE POLICY "joins_insert" ON meetup_joins FOR INSERT WITH CHECK (
  auth.uid() = applicant_id AND
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
CREATE POLICY "joins_update" ON meetup_joins FOR UPDATE USING (
  auth.uid() = (SELECT organizer_id FROM place_meetups WHERE id = meetup_id)
);
CREATE POLICY "joins_delete" ON meetup_joins FOR DELETE USING (auth.uid() = applicant_id);
