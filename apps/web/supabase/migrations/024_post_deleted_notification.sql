-- notifications 테이블 type CHECK에 'post_deleted' 추가
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type = ANY (ARRAY[
      'meetup_today', 'join_new', 'join_accepted', 'join_rejected',
      'join_unmatched', 'message_new', 'post_deleted'
    ])
  );
