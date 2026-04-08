CREATE TABLE IF NOT EXISTS gemini_usage (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

ALTER TABLE gemini_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner read" ON gemini_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "owner upsert" ON gemini_usage FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "owner update" ON gemini_usage FOR UPDATE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION increment_gemini_usage(p_user_id UUID, p_date DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO gemini_usage(user_id, date, count) VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, date) DO UPDATE SET count = gemini_usage.count + 1;
END;
$$;
