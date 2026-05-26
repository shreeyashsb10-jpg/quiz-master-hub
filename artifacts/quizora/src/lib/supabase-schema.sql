-- ============================================================
-- QUIZORA — Supabase Schema (Multi-Category SaaS)
-- Run this in Supabase SQL Editor to set up the database
-- For existing databases, run supabase-migration.sql instead
-- ============================================================

create extension if not exists "uuid-ossp";

-- ============================================================
-- CATEGORIES
-- ============================================================
create table if not exists categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text not null unique,
  icon text,
  created_at timestamptz default now()
);

insert into categories (name, slug, icon) values
  ('Medical PG', 'medical-pg', '🏥'),
  ('NEET UG',    'neet-ug',    '🔬'),
  ('JEE',        'jee',        '⚛️'),
  ('Class 10',   'class-10',   '📚'),
  ('Class 12',   'class-12',   '🎓')
on conflict (slug) do nothing;

-- ============================================================
-- INSTITUTES
-- ============================================================
create table if not exists institutes (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  category_id uuid references categories(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================
-- SUBJECTS
-- ============================================================
create table if not exists subjects (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  icon text,
  category_id uuid references categories(id) on delete set null,
  created_at timestamptz default now()
);

-- ============================================================
-- TOPICS
-- ============================================================
create table if not exists topics (
  id uuid default uuid_generate_v4() primary key,
  subject_id uuid references subjects(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now(),
  unique(subject_id, name)
);

-- ============================================================
-- USERS (extends Supabase auth.users)
-- Roles: 'user' (student), 'admin'/'super_admin', 'institute_admin'
-- ============================================================
create table if not exists users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  college_name text,        -- legacy; maps to institute_name
  mbbs_year text,           -- legacy; maps to academic_year
  avatar_url text,
  plan_type text default 'free' check (plan_type in ('free', 'pro')),
  subscription_status text check (subscription_status in ('active', 'inactive')),
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  total_points integer default 0,
  weekly_points integer default 0,
  streak integer default 0,
  role text default 'user' check (role in ('user', 'admin', 'super_admin', 'institute_admin')),
  -- multi-category SaaS fields
  category_id uuid references categories(id) on delete set null,
  exam_type text,           -- e.g. 'NEET PG', 'JEE Main'
  academic_year text,       -- e.g. '3rd Year MBBS', 'Class 12'
  institute_name text,      -- college / coaching institute
  institute_id uuid references institutes(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- QUESTIONS
-- ============================================================
create table if not exists questions (
  id uuid default uuid_generate_v4() primary key,
  subject_id uuid references subjects(id) on delete cascade not null,
  topic_id uuid references topics(id) on delete set null,
  question_text text not null,
  option_a text not null,
  option_b text not null,
  option_c text not null,
  option_d text not null,
  correct_answer text not null check (correct_answer in ('A', 'B', 'C', 'D')),
  explanation text,
  image_url text,
  difficulty text default 'medium' check (difficulty in ('easy', 'medium', 'hard')),
  created_at timestamptz default now()
);

-- ============================================================
-- QUIZZES
-- ============================================================
create table if not exists quizzes (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  subject_id uuid references subjects(id) on delete set null,
  quiz_type text default 'practice' check (quiz_type in ('live', 'practice')),
  status text default 'upcoming' check (status in ('upcoming', 'live', 'ended')),
  start_time timestamptz,
  end_time timestamptz,
  duration_minutes integer default 30,
  is_premium boolean default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- QUIZ QUESTIONS (join table)
-- ============================================================
create table if not exists quiz_questions (
  id uuid default uuid_generate_v4() primary key,
  quiz_id uuid references quizzes(id) on delete cascade not null,
  question_id uuid references questions(id) on delete cascade not null,
  order_index integer not null default 0,
  unique(quiz_id, question_id)
);

-- ============================================================
-- ATTEMPTS
-- ============================================================
create table if not exists attempts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  quiz_id uuid references quizzes(id) on delete cascade not null,
  score integer default 0,
  total_questions integer default 0,
  correct_answers integer default 0,
  time_taken_seconds integer default 0,
  answers jsonb default '{}',
  submitted_at timestamptz default now(),
  created_at timestamptz default now(),
  unique(user_id, quiz_id)
);

-- ============================================================
-- LEADERBOARD
-- ============================================================
create table if not exists leaderboard (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  quiz_id uuid references quizzes(id) on delete cascade,
  period text default 'global' check (period in ('global', 'weekly', 'quiz')),
  score integer default 0,
  rank integer,
  accuracy numeric(5,2) default 0,
  time_taken_seconds integer default 0,
  updated_at timestamptz default now()
);

-- ============================================================
-- RLS POLICIES
-- ============================================================
alter table categories enable row level security;
alter table institutes enable row level security;
alter table subjects enable row level security;
alter table topics enable row level security;
alter table users enable row level security;
alter table questions enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table attempts enable row level security;
alter table leaderboard enable row level security;

-- Categories: public read
create policy "categories_read_all" on categories for select using (true);

-- Institutes: public read
create policy "institutes_read_all" on institutes for select using (true);

-- Subjects: public read
create policy "subjects_read_all" on subjects for select using (true);

-- Topics: public read
create policy "topics_read_all" on topics for select using (true);

-- Users: own row
create policy "users_read_own" on users for select using (auth.uid() = id);
create policy "users_update_own" on users for update using (auth.uid() = id);
create policy "users_insert_own" on users for insert with check (auth.uid() = id);

-- Questions: public read, admin write
create policy "questions_read_all" on questions for select using (true);
create policy "questions_admin_write" on questions for all
  using (exists (select 1 from users where id = auth.uid() and role in ('admin','super_admin','institute_admin')));

-- Quizzes: public read, admin write
create policy "quizzes_read_all" on quizzes for select using (true);
create policy "quizzes_admin_write" on quizzes for all
  using (exists (select 1 from users where id = auth.uid() and role in ('admin','super_admin','institute_admin')));

-- Quiz questions: public read, admin write
create policy "quiz_questions_read_all" on quiz_questions for select using (true);
create policy "quiz_questions_admin_write" on quiz_questions for all
  using (exists (select 1 from users where id = auth.uid() and role in ('admin','super_admin','institute_admin')));

-- Attempts: own row
create policy "attempts_own" on attempts for all using (auth.uid() = user_id);

-- Leaderboard: public read
create policy "leaderboard_read_all" on leaderboard for select using (true);
create policy "leaderboard_own_write" on leaderboard for all using (auth.uid() = user_id);
