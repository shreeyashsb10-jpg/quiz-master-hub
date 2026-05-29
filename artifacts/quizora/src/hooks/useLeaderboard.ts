import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";

export interface LeaderboardEntry {
  id: string;
  user_id: string;
  quiz_id: string | null;
  period: "global" | "weekly" | "quiz";
  score: number;
  rank: number | null;
  accuracy: number;
  time_taken_seconds: number;
  updated_at: string;
  users?: { full_name: string | null; college_name: string | null; avatar_url: string | null };
}

export function useLeaderboard(
  period: "global" | "weekly" | "quiz" = "global",
  quizId?: string,
  limit = 100
) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    const fields = "id, user_id, quiz_id, period, score, rank, accuracy, time_taken_seconds, updated_at";

    let q;
    if (period === "quiz") {
      if (!quizId) {
        setEntries([]);
        setLoading(false);
        return;
      }
      q = supabase
        .from("leaderboard")
        .select(fields)
        .eq("period", "quiz")
        .eq("quiz_id", quizId)
        .order("score", { ascending: false })
        .order("time_taken_seconds", { ascending: true })
        .order("accuracy", { ascending: false })
        .limit(limit);
    } else {
      q = supabase
        .from("leaderboard")
        .select(fields)
        .eq("period", period)
        .is("quiz_id", null)
        .order("score", { ascending: false })
        .order("accuracy", { ascending: false })
        .limit(limit);
    }

    const { data, error: fetchError } = await q;

    if (fetchError) {
      setError(fetchError.message);
      setEntries([]);
    } else {
      setEntries((data as LeaderboardEntry[]) ?? []);
    }
    setLoading(false);
  }, [period, quizId, limit]);

  useEffect(() => { fetch(); }, [fetch]);

  return { entries, loading, error, refetch: fetch };
}
