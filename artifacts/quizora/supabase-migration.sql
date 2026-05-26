-- ============================================================
-- QUIZORA — Multi-Category SaaS Migration
-- Run this in your Supabase SQL Editor (supabase.com → Project → SQL Editor)
-- ============================================================

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Seed default categories
INSERT INTO categories (name, slug, icon) VALUES
  ('Medical PG', 'medical-pg', '🏥'),
  ('NEET UG',    'neet-ug',    '🔬'),
  ('JEE',        'jee',        '⚛️'),
  ('Class 10',   'class-10',   '📚'),
  ('Class 12',   'class-12',   '🎓')
ON CONFLICT (slug) DO NOTHING;

-- 3. Create institutes table
CREATE TABLE IF NOT EXISTS institutes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Add category_id to subjects
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- 5. Tag all existing subjects as Medical PG (they were MBBS subjects)
UPDATE subjects
SET category_id = (SELECT id FROM categories WHERE slug = 'medical-pg')
WHERE category_id IS NULL;

-- 6. Add subjects for other categories
INSERT INTO subjects (name, category_id) VALUES
  -- NEET UG
  ('Physics',     (SELECT id FROM categories WHERE slug = 'neet-ug')),
  ('Chemistry',   (SELECT id FROM categories WHERE slug = 'neet-ug')),
  ('Biology',     (SELECT id FROM categories WHERE slug = 'neet-ug')),
  -- JEE
  ('Physics',     (SELECT id FROM categories WHERE slug = 'jee')),
  ('Chemistry',   (SELECT id FROM categories WHERE slug = 'jee')),
  ('Mathematics', (SELECT id FROM categories WHERE slug = 'jee')),
  -- Class 10
  ('Science',     (SELECT id FROM categories WHERE slug = 'class-10')),
  ('Maths',       (SELECT id FROM categories WHERE slug = 'class-10')),
  ('English',     (SELECT id FROM categories WHERE slug = 'class-10')),
  ('SST',         (SELECT id FROM categories WHERE slug = 'class-10')),
  -- Class 12
  ('Physics',     (SELECT id FROM categories WHERE slug = 'class-12')),
  ('Chemistry',   (SELECT id FROM categories WHERE slug = 'class-12')),
  ('Biology',     (SELECT id FROM categories WHERE slug = 'class-12')),
  ('Maths',       (SELECT id FROM categories WHERE slug = 'class-12'))
ON CONFLICT DO NOTHING;

-- 7. Extend users table with new SaaS fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS exam_type TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS academic_year TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS institute_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS institute_id UUID REFERENCES institutes(id) ON DELETE SET NULL;

-- 8. Drop the old role constraint and extend to include new roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'institute_admin', 'super_admin'));

-- 9. Current 'admin' accounts become super_admin
UPDATE users SET role = 'super_admin' WHERE role = 'admin';
-- (Keep 'user' as the default student role for now)

-- 10. Enable RLS on new tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "categories_read_all" ON categories FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "institutes_read_all" ON institutes FOR SELECT USING (true);
CREATE POLICY IF NOT EXISTS "institutes_admin_write" ON institutes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

-- Done!
SELECT 'Migration complete ✓' AS status;
