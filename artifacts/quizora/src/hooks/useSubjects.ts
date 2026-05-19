import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface Subject {
  id: string;
  name: string;
  description: string | null;
  quiz_count?: number;
}

export function useSubjects() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("subjects").select("*").order("name").then(({ data }) => {
      setSubjects((data as Subject[]) ?? []);
      setLoading(false);
    });
  }, []);

  return { subjects, loading };
}
