import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = "user" | "admin" | "institute_admin" | "super_admin";

export type Tables = {
  categories: {
    id: string;
    name: string;
    slug: string;
    icon: string | null;
    created_at: string;
  };
  institutes: {
    id: string;
    name: string;
    category_id: string | null;
    created_at: string;
  };
  users: {
    id: string;
    email: string;
    full_name: string | null;
    college_name: string | null;
    mbbs_year: string | null;
    avatar_url: string | null;
    plan_type: "free" | "pro";
    subscription_status: "active" | "inactive" | null;
    subscription_start_date: string | null;
    subscription_end_date: string | null;
    total_points: number;
    weekly_points: number;
    streak: number;
    role: UserRole;
    category_id: string | null;
    exam_type: string | null;
    academic_year: string | null;
    institute_name: string | null;
    institute_id: string | null;
    created_at: string;
    updated_at: string;
  };
  subjects: {
    id: string;
    name: string;
    description: string | null;
    icon: string | null;
    category_id: string | null;
    created_at: string;
  };
  topics: {
    id: string;
    subject_id: string;
    name: string;
    created_at: string;
  };
  questions: {
    id: string;
    subject_id: string;
    topic_id: string | null;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    correct_answer: "A" | "B" | "C" | "D";
    explanation: string | null;
    image_url: string | null;
    difficulty: "easy" | "medium" | "hard";
    created_at: string;
  };
  quizzes: {
    id: string;
    title: string;
    description: string | null;
    subject_id: string | null;
    quiz_type: "live" | "practice";
    status: "upcoming" | "live" | "ended";
    start_time: string | null;
    end_time: string | null;
    duration_minutes: number;
    is_premium: boolean;
    created_by: string;
    created_at: string;
    updated_at: string;
  };
  quiz_questions: {
    id: string;
    quiz_id: string;
    question_id: string;
    order_index: number;
  };
  attempts: {
    id: string;
    user_id: string;
    quiz_id: string;
    score: number;
    total_questions: number;
    correct_answers: number;
    time_taken_seconds: number;
    answers: Record<string, string>;
    submitted_at: string;
    created_at: string;
  };
  leaderboard: {
    id: string;
    user_id: string;
    quiz_id: string | null;
    period: "global" | "weekly" | "quiz";
    score: number;
    rank: number | null;
    accuracy: number;
    time_taken_seconds: number;
    updated_at: string;
  };
};

// Category metadata — exam type and year options per category slug
export const CATEGORY_META: Record<string, { examTypes: string[]; yearOptions: string[] }> = {
  "medical-pg": {
    examTypes: ["NEET PG", "INICET", "FMGE"],
    yearOptions: ["1st Year MBBS", "2nd Year MBBS", "3rd Year MBBS", "Final Year MBBS", "Intern", "Graduate"],
  },
  "neet-ug": {
    examTypes: ["NEET UG"],
    yearOptions: ["11th", "12th", "Dropper"],
  },
  "jee": {
    examTypes: ["JEE Main", "JEE Advanced"],
    yearOptions: ["11th", "12th", "Dropper"],
  },
  "class-10": {
    examTypes: ["Board Exam"],
    yearOptions: ["Class 10"],
  },
  "class-12": {
    examTypes: ["Board Exam"],
    yearOptions: ["Class 12"],
  },
};
