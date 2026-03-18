-- Drop old columns, add new ones for multi-day course support
ALTER TABLE saved_courses
  DROP COLUMN IF EXISTS destination_name,
  DROP COLUMN IF EXISTS time_budget,
  DROP COLUMN IF EXISTS total_tip,
  DROP COLUMN IF EXISTS ordered_places,
  ADD COLUMN IF NOT EXISTS days INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS style TEXT DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS companion TEXT DEFAULT 'friends',
  ADD COLUMN IF NOT EXISTS start_hour INT DEFAULT 10,
  ADD COLUMN IF NOT EXISTS course_data JSONB,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Update RLS: allow public courses to be viewed by anyone
DROP POLICY IF EXISTS "본인 코스만 조회" ON saved_courses;
CREATE POLICY "코스 조회" ON saved_courses
  FOR SELECT USING (is_public = true OR auth.uid() = user_id);
