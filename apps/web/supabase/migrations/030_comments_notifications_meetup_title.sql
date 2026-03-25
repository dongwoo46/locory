-- ① 번개 모임 title 컬럼 추가
ALTER TABLE place_meetups ADD COLUMN IF NOT EXISTS title TEXT;

-- ② notifications type 제약 갱신 (post_liked, post_saved 추가)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (
  type = ANY (ARRAY[
    'meetup_today','join_new','join_accepted','join_rejected',
    'join_unmatched','message_new','post_deleted','post_liked','post_saved'
  ])
);

-- ③ post_comments 테이블
CREATE TABLE IF NOT EXISTS post_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 200),
  created_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read comments"  ON post_comments FOR SELECT USING (deleted_at IS NULL);
CREATE POLICY "owner insert comment"  ON post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner soft delete"     ON post_comments FOR UPDATE USING (auth.uid() = user_id);

-- ④ 좋아요 알림 트리거
CREATE OR REPLACE FUNCTION notify_post_liked()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_author   UUID;
  v_nickname TEXT;
BEGIN
  SELECT user_id INTO v_author FROM posts WHERE id = NEW.post_id AND deleted_at IS NULL;
  IF v_author IS NULL OR v_author = NEW.user_id THEN RETURN NEW; END IF;
  SELECT nickname INTO v_nickname FROM profiles WHERE id = NEW.user_id;
  INSERT INTO notifications(id, user_id, type, title, body, data) VALUES (
    gen_random_uuid(), v_author, 'post_liked',
    v_nickname || '님이 회원님의 포스트를 좋아합니다',
    '포스트에 좋아요가 달렸어요',
    jsonb_build_object('post_id', NEW.post_id, 'actor_id', NEW.user_id)
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_post_liked ON post_likes;
CREATE TRIGGER trg_post_liked
  AFTER INSERT ON post_likes FOR EACH ROW EXECUTE FUNCTION notify_post_liked();

-- ⑤ 저장 알림 트리거
CREATE OR REPLACE FUNCTION notify_post_saved()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_author   UUID;
  v_nickname TEXT;
BEGIN
  SELECT user_id INTO v_author FROM posts WHERE id = NEW.post_id AND deleted_at IS NULL;
  IF v_author IS NULL OR v_author = NEW.user_id THEN RETURN NEW; END IF;
  SELECT nickname INTO v_nickname FROM profiles WHERE id = NEW.user_id;
  INSERT INTO notifications(id, user_id, type, title, body, data) VALUES (
    gen_random_uuid(), v_author, 'post_saved',
    v_nickname || '님이 회원님의 포스트를 저장했어요',
    '포스트가 저장되었어요',
    jsonb_build_object('post_id', NEW.post_id, 'actor_id', NEW.user_id)
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_post_saved ON post_saves;
CREATE TRIGGER trg_post_saved
  AFTER INSERT ON post_saves FOR EACH ROW EXECUTE FUNCTION notify_post_saved();

-- ⑥ 번개 신청 알림 트리거 (join_new)
CREATE OR REPLACE FUNCTION notify_join_new()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_organizer UUID;
  v_place     TEXT;
  v_date      TEXT;
  v_nickname  TEXT;
BEGIN
  SELECT pm.organizer_id, pl.name,
         to_char(pm.scheduled_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI')
    INTO v_organizer, v_place, v_date
    FROM place_meetups pm JOIN places pl ON pl.id = pm.place_id
   WHERE pm.id = NEW.meetup_id;
  SELECT nickname INTO v_nickname FROM profiles WHERE id = NEW.applicant_id;
  INSERT INTO notifications(id, user_id, type, title, body, data) VALUES (
    gen_random_uuid(), v_organizer, 'join_new',
    v_nickname || '님이 번개 모임을 신청했어요',
    v_place || ' · ' || v_date,
    jsonb_build_object('meetup_id', NEW.meetup_id, 'join_id', NEW.id, 'actor_id', NEW.applicant_id)
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_join_new ON meetup_joins;
CREATE TRIGGER trg_join_new
  AFTER INSERT ON meetup_joins FOR EACH ROW EXECUTE FUNCTION notify_join_new();

-- ⑦ 번개 신청 상태 변경 알림 트리거 (accepted / rejected / unmatched)
CREATE OR REPLACE FUNCTION notify_join_status()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_organizer_nick TEXT;
  v_place          TEXT;
  v_date           TEXT;
  v_type           TEXT;
  v_title          TEXT;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('accepted','rejected','unmatched') THEN RETURN NEW; END IF;
  SELECT pr.nickname, pl.name,
         to_char(pm.scheduled_at AT TIME ZONE 'Asia/Seoul', 'MM/DD HH24:MI')
    INTO v_organizer_nick, v_place, v_date
    FROM place_meetups pm
    JOIN profiles pr ON pr.id = pm.organizer_id
    JOIN places   pl ON pl.id = pm.place_id
   WHERE pm.id = NEW.meetup_id;
  v_type := 'join_' || NEW.status;
  IF    NEW.status = 'accepted'  THEN v_title := v_organizer_nick || '님이 번개 신청을 수락했어요';
  ELSIF NEW.status = 'rejected'  THEN v_title := v_organizer_nick || '님이 번개 신청을 거절했어요';
  ELSE                                v_title := '번개 매칭이 취소되었어요';
  END IF;
  INSERT INTO notifications(id, user_id, type, title, body, data) VALUES (
    gen_random_uuid(), NEW.applicant_id, v_type, v_title,
    v_place || ' · ' || v_date,
    jsonb_build_object('meetup_id', NEW.meetup_id, 'join_id', NEW.id)
  );
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_join_status ON meetup_joins;
CREATE TRIGGER trg_join_status
  AFTER UPDATE ON meetup_joins FOR EACH ROW EXECUTE FUNCTION notify_join_status();
