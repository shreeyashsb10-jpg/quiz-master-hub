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
  /** Student view: shows this institute's quizzes + public (null) ones */
  institute_id?: string | null;
  /** Admin view: ONLY this institute's quizzes */
  strict_institute?: boolean;
  /**
   * Pass `profileLoaded` so the hook fires a second fetch once the profile
   * finishes loading. Without this, institute_id can stay `undefined` both
   * before *and* after the profile loads (when institute_id is null), causing
   * no re-fetch and potentially stale/empty data.
   */
  profileLoaded?: boolean;
}) {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    // Don't query until profile has resolved
    if (filters?.profileLoaded === false) {
      console.log("[useQuizzes] Waiting for profile to load…");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    let q = supabase
      .from("quizzes")
      .select(
        "id, title, description, subject_id, quiz_type, status, start_time, end_time, duration_minutes, is_premium, created_by, created_at, institute_id, subjects(name)"
      )
      .order("created_at", { ascending: false });

    if (filters?.type) q = q.eq("quiz_type", filters.type);
    if (filters?.subject_id) q = q.eq("subject_id", filters.subject_id);

    // Institute isolation
    if (filters?.institute_id) {
      if (filters?.strict_institute) {
        q = q.eq("institute_id", filters.institute_id);
      } else {
        // Student: their institute's quizzes + public (null institute_id)
        q = q.or(`institute_id.eq.${filters.institute_id},institute_id.is.null`);
      }
    }

    const { data, error: err } = await q;

    if (err) {
      console.error(
        "[useQuizzes] Query FAILED",
        "| code:", err.code,
        "| hint:", err.hint,
        "| message:", err.message,
        "| filters:", filters,
      );
      setError(`${err.code}: ${err.message}`);
      setLoading(false);
      return;
    }

    let filtered = (data as Quiz[]) ?? [];
    console.log(
      "[useQuizzes] OK →", filtered.length, "quizzes",
      "| institute_id:", filters?.institute_id ?? "(all)",
      "| profileLoaded:", filters?.profileLoaded,
    );

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
    setLoading(false);
  }, [
    filters?.type,
    filters?.status,
    filters?.subject_id,
    filters?.institute_id,
    filters?.strict_institute,
    // KEY FIX: include profileLoaded so the callback regenerates (and useEffect
    // re-fires) when the profile transitions from "loading" → "ready".
    filters?.profileLoaded,
  ]);

  useEffect(() => { fetch(); }, [fetch]);

  return { quizzes, loading, error, refetch: fetch };
}

export function useQuiz(id: string | undefined) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("quizzes")
      .select("*, subjects(name)")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error("[useQuiz] Failed to load quiz", id, error.message);
        }
        setQuiz(data as Quiz | null);
        setLoading(false);
      });
  }, [id]);

  return { quiz, loading };
}
