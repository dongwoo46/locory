-- Add place context to post-like/post-save notifications
-- so users can immediately tell which post/place the activity refers to.

CREATE OR REPLACE FUNCTION notify_post_liked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_author uuid;
  v_nickname text;
  v_place_id uuid;
  v_place_name text;
BEGIN
  SELECT p.user_id, p.place_id, pl.name
    INTO v_author, v_place_id, v_place_name
  FROM posts p
  LEFT JOIN places pl ON pl.id = p.place_id
  WHERE p.id = NEW.post_id
    AND p.deleted_at IS NULL;

  IF v_author IS NULL OR v_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO v_nickname
  FROM profiles
  WHERE id = NEW.user_id;

  INSERT INTO notifications (id, user_id, type, title, body, data)
  VALUES (
    gen_random_uuid(),
    v_author,
    'post_liked',
    CASE
      WHEN v_place_name IS NOT NULL
        THEN v_nickname || '님이 회원님의 ' || v_place_name || ' 포스트를 좋아합니다'
      ELSE v_nickname || '님이 회원님의 포스트를 좋아합니다'
    END,
    CASE
      WHEN v_place_name IS NOT NULL
        THEN v_place_name || ' 포스트에 좋아요를 눌렀어요'
      ELSE '포스트에 좋아요가 눌렸어요'
    END,
    jsonb_build_object(
      'post_id', NEW.post_id,
      'actor_id', NEW.user_id,
      'place_id', v_place_id,
      'place_name', v_place_name
    )
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_post_saved()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_author uuid;
  v_nickname text;
  v_place_id uuid;
  v_place_name text;
BEGIN
  SELECT p.user_id, p.place_id, pl.name
    INTO v_author, v_place_id, v_place_name
  FROM posts p
  LEFT JOIN places pl ON pl.id = p.place_id
  WHERE p.id = NEW.post_id
    AND p.deleted_at IS NULL;

  IF v_author IS NULL OR v_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT nickname INTO v_nickname
  FROM profiles
  WHERE id = NEW.user_id;

  INSERT INTO notifications (id, user_id, type, title, body, data)
  VALUES (
    gen_random_uuid(),
    v_author,
    'post_saved',
    CASE
      WHEN v_place_name IS NOT NULL
        THEN v_nickname || '님이 회원님의 ' || v_place_name || ' 포스트를 저장했어요'
      ELSE v_nickname || '님이 회원님의 포스트를 저장했어요'
    END,
    CASE
      WHEN v_place_name IS NOT NULL
        THEN v_place_name || ' 장소를 저장했어요'
      ELSE '포스트가 저장되었어요'
    END,
    jsonb_build_object(
      'post_id', NEW.post_id,
      'actor_id', NEW.user_id,
      'place_id', v_place_id,
      'place_name', v_place_name
    )
  );

  RETURN NEW;
END;
$$;

