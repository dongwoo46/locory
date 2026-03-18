-- 장소 좋아요
CREATE TABLE place_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id UUID NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, place_id)
);

ALTER TABLE place_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "place_likes_select" ON place_likes FOR SELECT USING (true);
CREATE POLICY "place_likes_insert" ON place_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "place_likes_delete" ON place_likes FOR DELETE USING (auth.uid() = user_id);
