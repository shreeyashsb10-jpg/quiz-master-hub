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

export function useLeaderboard(period: "global" | "weekly" | "quiz" = "global", quizId?: string) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("leaderboard")
      .select("*, users(full_name, college_name, avatar_url)")
      .eq("period", period)
      .order("score", { ascending: false })
      .order("accuracy", { ascending: false })
      .limit(50);

    if (period === "quiz" && quizId) q = q.eq("quiz_id", quizId);

    const { data } = await q;
    setEntries((data as LeaderboardEntry[]) ?? []);
    setLoading(false);
  }, [period, quizId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { entries, loading, refetch: fetch };
}
