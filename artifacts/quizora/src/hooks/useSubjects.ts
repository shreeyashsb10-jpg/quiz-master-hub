import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface Subject {
  id: string;
  name: string;
  description: string | null;
  category_id: string | null;
  quiz_count?: number;
}

export function useSubjects(categoryId?: string | null) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let query = supabase.from("subjects").select("id, name, description, category_id").order("name");
    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }
    query.then(({ data }) => {
      setSubjects((data as Subject[]) ?? []);
      setLoading(false);
    });
  }, [categoryId]);

  return { subjects, loading };
}
