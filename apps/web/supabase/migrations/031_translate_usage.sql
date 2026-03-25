-- 번역 사용 횟수 추적 테이블 (사용자별 일 5회 제한)
CREATE TABLE IF NOT EXISTS translate_usage (
  user_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date     DATE NOT NULL DEFAULT CURRENT_DATE,
  count    INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

ALTER TABLE translate_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner read"   ON translate_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner upsert" ON translate_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update" ON translate_usage FOR UPDATE USING (auth.uid() = user_id);

-- 원자적 increment 함수 (service role 없이도 안전하게 upsert)
CREATE OR REPLACE FUNCTION increment_translate_usage(p_user_id UUID, p_date DATE)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO translate_usage(user_id, date, count) VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date) DO UPDATE SET count = translate_usage.count + 1;
END;
$$;
