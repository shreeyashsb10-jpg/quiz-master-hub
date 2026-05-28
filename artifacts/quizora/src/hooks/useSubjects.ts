import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface Subject {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  quiz_count?: number;
}

/**
 * Fetch subjects filtered by category.
 * Pass `profileLoaded` so the hook waits for profile before running its
 * first query — prevents a double-fetch with wrong filter values.
 */
export function useSubjects(categoryId?: string | null, profileLoaded?: boolean) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // If caller signals profile is still loading, skip until it's ready.
    // profileLoaded=undefined means caller doesn't use profile → fetch immediately.
    if (profileLoaded === false) {
      console.log("[useSubjects] Waiting for profile to load…");
      return;
    }

    setLoading(true);
    setError(null);

    let q = supabase
      .from("subjects")
      .select("id, name, description, category_id")
      .order("name");

    if (categoryId) {
      q = q.eq("category_id", categoryId);
    }

    q.then(({ data, error: err }) => {
      if (err) {
        console.error(
          "[useSubjects] Query FAILED",
          "| code:", err.code,
          "| hint:", err.hint,
          "| message:", err.message,
          "| categoryId:", categoryId ?? "(all)",
        );
        setError(`${err.code}: ${err.message}`);
        setSubjects([]);
      } else {
        console.log(
          "[useSubjects] OK →", data?.length ?? 0, "subjects",
          "| categoryId:", categoryId ?? "(all)",
        );
        setSubjects((data as Subject[]) ?? []);
      }
      setLoading(false);
    });
  // Re-run whenever categoryId changes (profile loaded) or profileLoaded flips true
  }, [categoryId, profileLoaded]);

  return { subjects, loading, error };
}
