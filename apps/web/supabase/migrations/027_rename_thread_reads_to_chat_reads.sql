-- meetup_thread_reads → meetup_chat_reads 이름 변경
-- 025가 이미 적용된 경우에만 실행 (테이블이 meetup_thread_reads로 존재할 때)

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'meetup_thread_reads'
  ) THEN
    ALTER TABLE meetup_thread_reads RENAME TO meetup_chat_reads;

    -- 기존 정책 정리
    DROP POLICY IF EXISTS "mtr_own"    ON meetup_chat_reads;
    DROP POLICY IF EXISTS "mtr_select" ON meetup_chat_reads;
    DROP POLICY IF EXISTS "mtr_insert" ON meetup_chat_reads;
    DROP POLICY IF EXISTS "mtr_update" ON meetup_chat_reads;
    DROP POLICY IF EXISTS "mtr_delete" ON meetup_chat_reads;

    -- 새 정책 적용
    CREATE POLICY "mcr_select" ON meetup_chat_reads
      FOR SELECT USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM place_meetups pm
          WHERE pm.id = meetup_chat_reads.meetup_id
            AND pm.organizer_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM meetup_joins mj
          WHERE mj.meetup_id = meetup_chat_reads.meetup_id
            AND mj.applicant_id = auth.uid()
            AND mj.status = 'accepted'
        )
      );

    CREATE POLICY "mcr_insert" ON meetup_chat_reads
      FOR INSERT WITH CHECK (user_id = auth.uid());

    CREATE POLICY "mcr_update" ON meetup_chat_reads
      FOR UPDATE USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());

    CREATE POLICY "mcr_delete" ON meetup_chat_reads
      FOR DELETE USING (user_id = auth.uid());

    RAISE NOTICE 'Renamed meetup_thread_reads → meetup_chat_reads and updated policies';
  ELSE
    RAISE NOTICE 'meetup_thread_reads not found, skipping rename';
  END IF;
END $$;
