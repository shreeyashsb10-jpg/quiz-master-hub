-- Fix: add missing write policies for institutes table
-- Run this in your Supabase dashboard → SQL Editor

-- Allow super_admins and admins to insert/update/delete institutes
DROP POLICY IF EXISTS "institutes_admin_write" ON institutes;
CREATE POLICY "institutes_admin_write" ON institutes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role IN ('admin', 'super_admin')
    )
  );
