-- scheduled_at이 지난 번개모임 자동 soft delete
-- pg_cron으로 매 시간 정각 실행

SELECT cron.schedule(
  'auto-close-meetups',
  '0 * * * *',
  $$
    UPDATE place_meetups
    SET
      status = 'closed',
      deleted_at = NOW()
    WHERE
      status = 'open'
      AND scheduled_at < NOW()
      AND deleted_at IS NULL;
  $$
);
