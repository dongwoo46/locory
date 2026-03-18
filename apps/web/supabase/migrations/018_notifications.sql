-- 알림 테이블
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN (
    'meetup_today',
    'join_new',
    'join_accepted',
    'join_rejected',
    'join_unmatched',
    'message_new'
  )),
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data       JSONB,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
DROP POLICY IF EXISTS "notifications_update" ON notifications;

CREATE POLICY "notifications_select" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────
-- 트리거 1: meetup_joins INSERT → 주최자에게 알림
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_notify_join_new()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_organizer UUID;
  v_place_name TEXT;
  v_scheduled TEXT;
  v_meetup_id UUID;
BEGIN
  v_meetup_id := NEW.meetup_id;

  SELECT pm.organizer_id,
         p.name,
         to_char(pm.scheduled_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI')
  INTO   v_organizer, v_place_name, v_scheduled
  FROM   place_meetups pm
  JOIN   places p ON p.id = pm.place_id
  WHERE  pm.id = v_meetup_id;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    v_organizer,
    'join_new',
    '새 번개 신청',
    v_place_name || ' · ' || v_scheduled,
    jsonb_build_object('meetup_id', v_meetup_id, 'join_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_join_new ON meetup_joins;
CREATE TRIGGER trg_notify_join_new
  AFTER INSERT ON meetup_joins
  FOR EACH ROW EXECUTE FUNCTION fn_notify_join_new();


-- ──────────────────────────────────────────────
-- 트리거 2: meetup_joins UPDATE → 신청자에게 알림
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_notify_join_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_place_name TEXT;
  v_scheduled  TEXT;
  v_type       TEXT;
  v_title      TEXT;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT p.name,
         to_char(pm.scheduled_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI')
  INTO   v_place_name, v_scheduled
  FROM   place_meetups pm
  JOIN   places p ON p.id = pm.place_id
  WHERE  pm.id = NEW.meetup_id;

  CASE NEW.status
    WHEN 'accepted'  THEN v_type := 'join_accepted';  v_title := '번개 수락됨';
    WHEN 'rejected'  THEN v_type := 'join_rejected';  v_title := '번개 거절됨';
    WHEN 'unmatched' THEN v_type := 'join_unmatched'; v_title := '번개 언매치됨';
    ELSE RETURN NEW;
  END CASE;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (
    NEW.applicant_id,
    v_type,
    v_title,
    v_place_name || ' · ' || v_scheduled,
    jsonb_build_object('meetup_id', NEW.meetup_id, 'join_id', NEW.id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_join_status ON meetup_joins;
CREATE TRIGGER trg_notify_join_status
  AFTER UPDATE ON meetup_joins
  FOR EACH ROW EXECUTE FUNCTION fn_notify_join_status();


-- ──────────────────────────────────────────────
-- 트리거 3: meetup_messages INSERT → 참여자 전원 알림
-- ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_notify_message_new()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sender_nick TEXT;
  v_place_name  TEXT;
  r             RECORD;
BEGIN
  SELECT nick.nickname, p.name
  INTO   v_sender_nick, v_place_name
  FROM   profiles nick
  JOIN   place_meetups pm ON pm.id = NEW.meetup_id
  JOIN   places p ON p.id = pm.place_id
  WHERE  nick.id = NEW.sender_id;

  FOR r IN
    SELECT organizer_id AS uid
    FROM   place_meetups
    WHERE  id = NEW.meetup_id AND organizer_id != NEW.sender_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      r.uid,
      'message_new',
      v_place_name || ' 스레드',
      v_sender_nick || ': ' || left(NEW.content, 40),
      jsonb_build_object('meetup_id', NEW.meetup_id, 'message_id', NEW.id)
    );
  END LOOP;

  FOR r IN
    SELECT applicant_id AS uid
    FROM   meetup_joins
    WHERE  meetup_id = NEW.meetup_id
      AND  status = 'accepted'
      AND  applicant_id != NEW.sender_id
  LOOP
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (
      r.uid,
      'message_new',
      v_place_name || ' 스레드',
      v_sender_nick || ': ' || left(NEW.content, 40),
      jsonb_build_object('meetup_id', NEW.meetup_id, 'message_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_message_new ON meetup_messages;
CREATE TRIGGER trg_notify_message_new
  AFTER INSERT ON meetup_messages
  FOR EACH ROW EXECUTE FUNCTION fn_notify_message_new();


-- ──────────────────────────────────────────────
-- pg_cron: 매일 09:00 KST (= 00:00 UTC) 번개 당일 알림
-- $cron$ 구분자로 내부 SQL과 외부 $$ 충돌 방지
-- ──────────────────────────────────────────────
DO $outer$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job WHERE jobname = 'meetup_today_notify';

    PERFORM cron.schedule(
      'meetup_today_notify',
      '0 0 * * *',
      $cron$
      INSERT INTO notifications (user_id, type, title, body, data)
      SELECT
        sub.uid,
        'meetup_today',
        '오늘 번개가 있어요',
        p.name || ' · ' || to_char(pm.scheduled_at AT TIME ZONE 'Asia/Seoul', 'HH24:MI'),
        jsonb_build_object('meetup_id', pm.id, 'place_id', pm.place_id)
      FROM (
        SELECT pm2.id AS meetup_id, pm2.organizer_id AS uid
        FROM   place_meetups pm2
        WHERE  DATE(pm2.scheduled_at AT TIME ZONE 'Asia/Seoul') = DATE(now() AT TIME ZONE 'Asia/Seoul')
          AND  pm2.status != 'expired'
        UNION ALL
        SELECT mj.meetup_id, mj.applicant_id AS uid
        FROM   meetup_joins mj
        JOIN   place_meetups pm3 ON pm3.id = mj.meetup_id
        WHERE  mj.status = 'accepted'
          AND  DATE(pm3.scheduled_at AT TIME ZONE 'Asia/Seoul') = DATE(now() AT TIME ZONE 'Asia/Seoul')
          AND  pm3.status != 'expired'
      ) sub
      JOIN place_meetups pm ON pm.id = sub.meetup_id
      JOIN places p ON p.id = pm.place_id;
      $cron$
    );
  END IF;
END;
$outer$;
