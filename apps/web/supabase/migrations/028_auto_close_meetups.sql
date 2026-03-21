-- scheduled_at이 지난 번개모임 자동 soft delete
-- ⚠️ pg_cron 활성화 필요: Dashboard → Database → Extensions → pg_cron 켜기
-- 활성화 후 Dashboard SQL Editor에서 아래 주석 해제 후 직접 실행:

/*
SELECT cron.schedule(
  'auto-close-meetups',
  '0 * * * *',
  $$
    UPDATE place_meetups
    SET status = 'closed', deleted_at = NOW()
    WHERE status = 'open'
      AND scheduled_at < NOW()
      AND deleted_at IS NULL;
  $$
);
*/

-- pg_cron 없이도 모든 쿼리에서 scheduled_at > NOW() 조건으로 필터링하므로
-- 만료된 모임은 목록에 노출되지 않음.
