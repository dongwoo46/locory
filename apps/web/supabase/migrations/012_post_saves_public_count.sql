-- post_saves 전체 조회 허용 (저장수 집계를 위해)
DROP POLICY IF EXISTS "본인 포스팅 저장 조회" ON post_saves;
CREATE POLICY "post_saves_select" ON post_saves FOR SELECT USING (true);
