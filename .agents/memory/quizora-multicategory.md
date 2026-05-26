---
name: Quizora Multi-Category Architecture
description: Key decisions for the multi-category SaaS transform — DB schema, role compat, profile setup gate.
---

## Database migration
- Migration SQL lives at `artifacts/quizora/supabase-migration.sql` — user must run it in Supabase SQL editor.
- New tables: `categories` (Medical PG / NEET UG / JEE / Class 10 / Class 12), `institutes`.
- New columns on `users`: `category_id`, `exam_type`, `academic_year`, `institute_name`, `institute_id`.
- New column on `subjects`: `category_id` — existing Medical PG subjects are auto-tagged by the migration.
- Full fresh-install schema is at `artifacts/quizora/src/lib/supabase-schema.sql`.

## Role compatibility
**Why:** The migration changes existing `role='admin'` → `role='super_admin'`, but we can't guarantee the migration has been run.
**Rule:** Always check `role === 'admin' || role === 'super_admin'` for admin access. `isAdmin` in AuthContext handles both. Never check `role === 'admin'` alone.

## Profile setup gate
- `isProfileComplete` in AuthContext: returns `true` for all admin roles, returns `true` if `category_id` column doesn't exist yet (pre-migration safety), returns `false` for students without `full_name` + `category_id`.
- `/profile-setup` route is outside the Layout wrapper (full-screen page).
- App.tsx redirects `role='user'` + incomplete profile → `/profile-setup`, redirects back to `/dashboard` once complete.

## Category metadata
- `CATEGORY_META` in `supabase.ts` maps category slug → `{ examTypes, yearOptions }` — drives dynamic dropdowns in profile-setup and profile pages.
- Five slugs: `medical-pg`, `neet-ug`, `jee`, `class-10`, `class-12`.

## useSubjects hook
- Accepts optional `categoryId` param. Dashboard passes `profile?.category_id` so students only see their category's subjects.
- Admin pages pass no `categoryId` — they use their own category filter Select.

## Legacy fields
- `college_name` / `mbbs_year` kept on users table for backward compat; new `institute_name` / `academic_year` are the canonical fields; save operations write both.
