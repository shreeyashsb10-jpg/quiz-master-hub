import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export interface Attempt {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  correct_answers: number;
  time_taken_seconds: number;
  answers: Record<string, string>;
  submitted_at: string;
  quizzes?: { title: string; subjects?: { name: string } | null };
}

export function useMyAttempts() {
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("attempts")
      .select("id, user_id, quiz_id, score, total_questions, correct_answers, time_taken_seconds, submitted_at, quizzes(title, subjects(name))")
      .eq("user_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setAttempts((data as Attempt[]) ?? []);
        setLoading(false);
      });
  }, [user]);

  return { attempts, loading };
}

export function useQuizAttempt(quizId: string | undefined) {
  const { user } = useAuth();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !quizId) { setLoading(false); return; }
    supabase
      .from("attempts")
      .select("*")
      .eq("user_id", user.id)
      .eq("quiz_id", quizId)
      .single()
      .then(({ data }) => {
        setAttempt(data as Attempt | null);
        setLoading(false);
      });
  }, [user, quizId]);

  return { attempt, loading };
}
