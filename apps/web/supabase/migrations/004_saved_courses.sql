CREATE TABLE IF NOT EXISTS saved_courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT '나의 코스',
  place_ids TEXT[] NOT NULL,
  ordered_places JSONB NOT NULL,
  origin_name TEXT NOT NULL,
  destination_name TEXT NOT NULL,
  transport TEXT NOT NULL CHECK (transport IN ('walking', 'transit', 'driving')),
  time_budget TEXT NOT NULL,
  total_tip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE saved_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "본인 코스만 조회" ON saved_courses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "본인 코스만 삽입" ON saved_courses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "본인 코스만 삭제" ON saved_courses FOR DELETE USING (auth.uid() = user_id);
