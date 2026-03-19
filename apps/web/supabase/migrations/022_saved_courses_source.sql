ALTER TABLE saved_courses ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'user_selected';
