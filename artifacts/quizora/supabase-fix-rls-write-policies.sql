-- ============================================================
-- Fix: Add missing WITH CHECK to all admin write policies
-- This is the root cause of insert/update hanging for admins.
-- Run this in Supabase dashboard → SQL Editor
-- ============================================================

-- Questions
DROP POLICY IF EXISTS "questions_admin_write" ON questions;
CREATE POLICY "questions_admin_write" ON questions
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND role IN ('admin','super_admin','institute_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND role IN ('admin','super_admin','institute_admin'))
  );

-- Quizzes
DROP POLICY IF EXISTS "quizzes_admin_write" ON quizzes;
CREATE POLICY "quizzes_admin_write" ON quizzes
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND role IN ('admin','super_admin','institute_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND role IN ('admin','super_admin','institute_admin'))
  );

-- Quiz questions
DROP POLICY IF EXISTS "quiz_questions_admin_write" ON quiz_questions;
CREATE POLICY "quiz_questions_admin_write" ON quiz_questions
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND role IN ('admin','super_admin','institute_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND role IN ('admin','super_admin','institute_admin'))
  );

-- Topics (admins must be able to create topics for bulk question upload)
DROP POLICY IF EXISTS "topics_admin_write" ON topics;
CREATE POLICY "topics_admin_write" ON topics
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND role IN ('admin','super_admin','institute_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND role IN ('admin','super_admin','institute_admin'))
  );

-- Ensure everyone can read topics (needed for dropdowns)
DROP POLICY IF EXISTS "topics_read_all" ON topics;
CREATE POLICY "topics_read_all" ON topics
  FOR SELECT USING (true);

-- Subjects (admins manage them)
DROP POLICY IF EXISTS "subjects_admin_write" ON subjects;
CREATE POLICY "subjects_admin_write" ON subjects
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND role IN ('admin','super_admin','institute_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND role IN ('admin','super_admin','institute_admin'))
  );

-- Institutes (super admins only)
DROP POLICY IF EXISTS "institutes_admin_write" ON institutes;
CREATE POLICY "institutes_admin_write" ON institutes
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND role IN ('admin','super_admin'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND role IN ('admin','super_admin'))
  );
