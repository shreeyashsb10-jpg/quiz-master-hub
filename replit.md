# Quizora

MBBS competitive quiz platform for medical students — live & practice quizzes, leaderboard, admin panel, bulk MCQ upload.

## Run & Operate

- `pnpm --filter @workspace/quizora run dev` — run the frontend (port 20593, preview `/`)
- `pnpm --filter @workspace/quizora run typecheck` — typecheck the frontend
- Required env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — both set in Replit Secrets

## Stack

- React + Vite + TypeScript + Tailwind CSS v4
- Supabase (Auth, Database, Storage) — direct client queries, no Express backend
- shadcn/ui components
- Wouter for routing
- TanStack Query for data caching

## Where things live

- `artifacts/quizora/src/` — all frontend source
- `artifacts/quizora/src/lib/supabase.ts` — Supabase client + type definitions
- `artifacts/quizora/src/lib/supabase-schema.sql` — **Full DB schema + RLS + seed** (run in Supabase SQL Editor)
- `artifacts/quizora/src/lib/utils.ts` — helpers: formatTime, formatCountdown, calcAccuracy, parseBulkMCQ
- `artifacts/quizora/src/contexts/AuthContext.tsx` — auth state, OTP, Google sign-in
- `artifacts/quizora/src/components/Layout.tsx` — sidebar (desktop) + bottom nav (mobile)
- `artifacts/quizora/src/pages/` — all pages (auth, dashboard, quizzes, quiz-detail, leaderboard, profile, admin/*)

## Architecture decisions

- **No backend** — Supabase PostgREST + RLS handles all data access; auth via Supabase Auth (OTP + Google OAuth)
- **Two-page quiz MCQ flow** — question shown first (full focus), then options on next screen (anti-distraction design)
- **Anti-cheat** — tab-blur detection + right-click disabled during live quizzes
- **Answer reveal** — unlocked only after quiz `end_time` for live quizzes; practice quizzes show answers immediately
- **Leaderboard** — three periods: `global`, `weekly`, `quiz`-specific; refreshed manually or on page load

## Product

- Email OTP + Google sign-in
- Dashboard with live/upcoming quiz cards, subject grid, leaderboard preview, stats
- Quiz engine: countdown timer, two-page question→options flow, score submission
- Leaderboard with global and weekly tabs
- User profiles with avatar upload, college/year info, quiz history
- Admin panel: bulk MCQ paste-upload with image support, question bank, quiz builder with question picker, subject/topic manager

## User preferences

_Populate as you build._

## Gotchas

- **Run the SQL schema first** — before signing in, execute `src/lib/supabase-schema.sql` in the Supabase project SQL Editor
- **Set admin role manually** — after first sign-in, run `UPDATE users SET role = 'admin' WHERE email = 'your@email.com';` in Supabase
- **Supabase Storage buckets** — create `avatars` and `question-images` buckets in Supabase Storage (set public read)
- The `increment_user_points` Supabase RPC function is called after quiz submission — add it to the schema or it silently fails (points won't update automatically)
- Attempts table has `UNIQUE(user_id, quiz_id)` — retakes use upsert and overwrite the previous score

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
