-- meetup_chat_reads RLS 수정
-- SELECT: 같은 번개 참가자(주최자 or 수락된 신청자)도 조회 가능 → realtime 읽음 표시 작동

DROP POLICY IF EXISTS "mcr_own" ON meetup_chat_reads;

-- SELECT: 자기 자신 OR 해당 번개의 주최자 OR 수락된 참가자
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

-- INSERT: 본인만
CREATE POLICY "mcr_insert" ON meetup_chat_reads
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE: 본인만
CREATE POLICY "mcr_update" ON meetup_chat_reads
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- DELETE: 본인만
CREATE POLICY "mcr_delete" ON meetup_chat_reads
  FOR DELETE USING (user_id = auth.uid());
