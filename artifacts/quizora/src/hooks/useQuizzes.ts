import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface Quiz {
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
  institute_id?: string | null;
  subjects?: { name: string } | null;
  question_count?: number;
}

export function useQuizzes(filters?: {
  type?: string;
  status?: string;
  subject_id?: string;
  // institute_id: shows institute quizzes + public (null) quizzes
  institute_id?: string | null;
  // strict_institute: shows ONLY this institute's quizzes (for admin view)
  strict_institute?: boolean;
}) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("quizzes")
      .select("*, subjects(name)")
      .order("created_at", { ascending: false });

    if (filters?.type) q = q.eq("quiz_type", filters.type);
    if (filters?.subject_id) q = q.eq("subject_id", filters.subject_id);

    // Institute isolation
    if (filters?.institute_id) {
      if (filters?.strict_institute) {
        // Admin view: only their institute's quizzes
        q = q.eq("institute_id", filters.institute_id);
      } else {
        // Student view: their institute's quizzes + public (null institute_id)
        q = q.or(`institute_id.eq.${filters.institute_id},institute_id.is.null`);
      }
    }

    const { data, error: err } = await q;
    if (err) setError(err.message);
    else {
      let filtered = (data as Quiz[]) ?? [];

      if (filters?.status) {
        const now = new Date();
        filtered = filtered.filter((quiz) => {
          const start = quiz.start_time ? new Date(quiz.start_time) : null;
          const end = quiz.end_time ? new Date(quiz.end_time) : null;
          let actualStatus: "upcoming" | "live" | "ended" = "ended";
          if (start && start > now) actualStatus = "upcoming";
          else if (start && end && start <= now && end >= now) actualStatus = "live";
          return actualStatus === filters.status;
        });
      }

      setQuizzes(filtered);
    }
    setLoading(false);
  }, [filters?.type, filters?.status, filters?.subject_id, filters?.institute_id, filters?.strict_institute]);

  useEffect(() => { fetch(); }, [fetch]);

  return { quizzes, loading, error, refetch: fetch };
}

export function useQuiz(id: string | undefined) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from("quizzes").select("*, subjects(name)").eq("id", id).single().then(({ data }) => {
      setQuiz(data as Quiz | null);
      setLoading(false);
    });
  }, [id]);

  return { quiz, loading };
}
