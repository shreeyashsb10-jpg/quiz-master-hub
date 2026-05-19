-- ============================================================
-- QUIZORA — Supabase Schema
-- Run this in Supabase SQL Editor to set up the database
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- SUBJECTS
-- ============================================================
create table if not exists subjects (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  description text,
  icon text,
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
-- ============================================================
create table if not exists users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  college_name text,
  mbbs_year text,
  avatar_url text,
  plan_type text default 'free' check (plan_type in ('free', 'pro')),
  subscription_status text check (subscription_status in ('active', 'inactive')),
  subscription_start_date timestamptz,
  subscription_end_date timestamptz,
  total_points integer default 0,
  weekly_points integer default 0,
  streak integer default 0,
  role text default 'user' check (role in ('user', 'admin')),
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
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- QUIZ QUESTIONS (junction)
-- ============================================================
create table if not exists quiz_questions (
  id uuid default uuid_generate_v4() primary key,
  quiz_id uuid references quizzes(id) on delete cascade not null,
  question_id uuid references questions(id) on delete cascade not null,
  order_index integer default 0,
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
-- ROW LEVEL SECURITY
-- ============================================================
alter table users enable row level security;
alter table subjects enable row level security;
alter table topics enable row level security;
alter table questions enable row level security;
alter table quizzes enable row level security;
alter table quiz_questions enable row level security;
alter table attempts enable row level security;
alter table leaderboard enable row level security;

-- Users: own row read/write
create policy "Users can view own profile" on users for select using (auth.uid() = id);
create policy "Users can update own profile" on users for update using (auth.uid() = id);
create policy "Users can insert own profile" on users for insert with check (auth.uid() = id);

-- Subjects: everyone reads, admins write
create policy "Anyone can read subjects" on subjects for select using (true);
create policy "Admins can manage subjects" on subjects for all using (
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);

-- Topics: everyone reads, admins write
create policy "Anyone can read topics" on topics for select using (true);
create policy "Admins can manage topics" on topics for all using (
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);

-- Questions: everyone reads, admins write
create policy "Anyone can read questions" on questions for select using (true);
create policy "Admins can manage questions" on questions for all using (
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);

-- Quizzes: everyone reads, admins write
create policy "Anyone can read quizzes" on quizzes for select using (true);
create policy "Admins can manage quizzes" on quizzes for all using (
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);

-- Quiz questions: everyone reads, admins write
create policy "Anyone can read quiz_questions" on quiz_questions for select using (true);
create policy "Admins can manage quiz_questions" on quiz_questions for all using (
  exists (select 1 from users where id = auth.uid() and role = 'admin')
);

-- Attempts: own rows
create policy "Users can read own attempts" on attempts for select using (auth.uid() = user_id);
create policy "Users can insert own attempts" on attempts for insert with check (auth.uid() = user_id);
create policy "Users can update own attempts" on attempts for update using (auth.uid() = user_id);

-- Leaderboard: everyone reads
create policy "Anyone can read leaderboard" on leaderboard for select using (true);
create policy "Users can upsert own leaderboard" on leaderboard for all using (auth.uid() = user_id);

-- ============================================================
-- TRIGGER: auto-create user profile on signup
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- SEED: MBBS Subjects
-- ============================================================
insert into subjects (name) values
  ('Anatomy'),
  ('Physiology'),
  ('Biochemistry'),
  ('Pathology'),
  ('Pharmacology'),
  ('Microbiology'),
  ('Forensic Medicine'),
  ('PSM'),
  ('ENT'),
  ('Ophthalmology'),
  ('Medicine'),
  ('Surgery'),
  ('Pediatrics'),
  ('Obstetrics and Gynecology'),
  ('Orthopedics'),
  ('Dermatology'),
  ('Psychiatry'),
  ('Radiology')
on conflict (name) do nothing;
